import type { AdminUserDto } from "@bitego/shared";
import type { Prisma, Role, UserStatus } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Admin: look at users and block / unblock them.
// A blocked user is refused by every API route (ACCOUNT_DISABLED), and the mobile app logs them out.

const include = { business: { select: { name: true } } } satisfies Prisma.UserInclude;
type Row = Prisma.UserGetPayload<{ include: typeof include }>;

function toDto(u: Row): AdminUserDto {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    businessName: u.business?.name ?? null,
  };
}

export async function listUsers(filter: { role?: Role; status?: UserStatus; q?: string }): Promise<AdminUserDto[]> {
  const where: Prisma.UserWhereInput = {
    ...(filter.role ? { role: filter.role } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.q
      ? {
          OR: [
            { email: { contains: filter.q, mode: "insensitive" } },
            { fullName: { contains: filter.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const rows = await prisma.user.findMany({ where, include, orderBy: { createdAt: "desc" }, take: 200 });
  return rows.map(toDto);
}

export async function setUserStatus(
  userId: string,
  adminId: string,
  status: "ACTIVE" | "BLOCKED",
): Promise<AdminUserDto> {
  if (userId === adminId) throw new ApiError(409, "CANNOT_CHANGE_SELF", "You cannot block your own account");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  if (target.role === "ADMIN") throw new ApiError(403, "ADMIN_PROTECTED", "Admin accounts cannot be blocked here");

  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status }, include }),
    prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: status === "BLOCKED" ? "USER_BLOCKED" : "USER_UNBLOCKED",
        entityType: "User",
        entityId: userId,
      },
    }),
  ]);

  return toDto(updated);
}
