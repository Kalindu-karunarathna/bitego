import type { AdminBusinessDto, BusinessStatusFilter } from "@bitego/shared";
import type { BusinessStatus, Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/modules/notifications/notify";

// Admin: review businesses that registered in the mobile app.
// A business stays PENDING (and cannot sell or buy) until an admin approves it here.

const include = {
  owner: { select: { id: true, fullName: true, email: true, phone: true } },
  verifications: { orderBy: { submittedAt: "desc" as const }, take: 1 },
} satisfies Prisma.BusinessInclude;

type Row = Prisma.BusinessGetPayload<{ include: typeof include }>;

function toDto(b: Row): AdminBusinessDto {
  const v = b.verifications[0];
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    status: b.status,
    registrationNo: b.registrationNo,
    description: b.description,
    contactNo: b.contactNo,
    addressLine: b.addressLine,
    city: b.city,
    district: b.district,
    latitude: b.latitude,
    longitude: b.longitude,
    createdAt: b.createdAt.toISOString(),
    owner: b.owner,
    verification: v
      ? {
          status: v.status,
          documentUrl: v.documentUrl,
          submittedAt: v.submittedAt.toISOString(),
          reviewedAt: v.reviewedAt?.toISOString() ?? null,
          remarks: v.remarks,
        }
      : null,
  };
}

export async function listBusinesses(status: BusinessStatusFilter): Promise<AdminBusinessDto[]> {
  const rows = await prisma.business.findMany({
    where: status === "ALL" ? {} : { status },
    include,
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 200,
  });
  return rows.map(toDto);
}

// Approve is allowed from PENDING (normal) and REJECTED (admin changed their mind). Reject only from PENDING.
const allowedFrom: Record<"APPROVE" | "REJECT", BusinessStatus[]> = {
  APPROVE: ["PENDING", "REJECTED"],
  REJECT: ["PENDING"],
};

export async function reviewBusiness(
  businessId: string,
  adminId: string,
  decision: "APPROVE" | "REJECT",
  remarks?: string,
): Promise<AdminBusinessDto> {
  const exists = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
  if (!exists) throw new ApiError(404, "BUSINESS_NOT_FOUND", "Business not found");

  const newStatus: BusinessStatus = decision === "APPROVE" ? "ACTIVE" : "REJECTED";
  const verificationStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  const cleanRemarks = remarks?.trim() || null;

  const updated = await prisma.$transaction(async (tx) => {
    // The status check inside the update makes this safe if two admins click at the same time.
    const changed = await tx.business.updateMany({
      where: { id: businessId, status: { in: allowedFrom[decision] } },
      data: { status: newStatus },
    });
    if (changed.count === 0) {
      throw new ApiError(
        409,
        "INVALID_STATE",
        decision === "APPROVE"
          ? "Only pending or rejected businesses can be approved"
          : "Only pending businesses can be rejected",
      );
    }

    const reviewed = { status: verificationStatus as "APPROVED" | "REJECTED", reviewedById: adminId, reviewedAt: new Date(), remarks: cleanRemarks };
    const latest = await tx.businessVerification.findFirst({ where: { businessId }, orderBy: { submittedAt: "desc" } });
    if (latest) {
      await tx.businessVerification.update({ where: { id: latest.id }, data: reviewed });
    } else {
      await tx.businessVerification.create({ data: { businessId, ...reviewed } });
    }

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: decision === "APPROVE" ? "BUSINESS_APPROVED" : "BUSINESS_REJECTED",
        entityType: "Business",
        entityId: businessId,
        metadata: cleanRemarks ? { remarks: cleanRemarks } : undefined,
      },
    });

    return tx.business.findUniqueOrThrow({ where: { id: businessId }, include });
  });

  // Tell the business owner. A failed notification must never undo the approval.
  try {
    await notify({
      userId: updated.owner.id,
      type: decision === "APPROVE" ? "BUSINESS_APPROVED" : "BUSINESS_REJECTED",
      title: decision === "APPROVE" ? "Your business is approved" : "Your business was not approved",
      message:
        decision === "APPROVE"
          ? `${updated.name} is approved. You can now post surplus food.`
          : `${updated.name} was not approved. ${cleanRemarks ?? ""}`.trim(),
    });
  } catch (err) {
    console.error("notify failed after business review:", err);
  }

  return toDto(updated);
}
