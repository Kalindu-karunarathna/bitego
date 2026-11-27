import { rejectBusinessSchema } from "@bitego/shared";
import { z } from "zod";
import { ApiError, ok, parseBody, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { reviewBusiness } from "@/server/modules/admin/businesses.service";

// POST /api/v1/admin/businesses/:id/reject  { "remarks": "reason" }  (admin only)
export const POST = route(async (req, ctx: RouteContext<"/api/v1/admin/businesses/[id]/reject">) => {
  const { user } = await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "BUSINESS_NOT_FOUND", "Business not found");
  const { remarks } = await parseBody(req, rejectBusinessSchema);
  return ok(await reviewBusiness(id, user.id, "REJECT", remarks));
});
