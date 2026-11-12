import { setUserStatusSchema } from "@bitego/shared";
import { z } from "zod";
import { ApiError, ok, parseBody, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { setUserStatus } from "@/server/modules/admin/users.service";

// POST /api/v1/admin/users/:id/status  { "status": "BLOCKED" | "ACTIVE" }  (admin only)
export const POST = route(async (req, ctx: RouteContext<"/api/v1/admin/users/[id]/status">) => {
  const { user } = await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  const { status } = await parseBody(req, setUserStatusSchema);
  return ok(await setUserStatus(id, user.id, status));
});
