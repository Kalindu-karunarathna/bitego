import { reviewReportSchema } from "@bitego/shared";
import { z } from "zod";
import { ApiError, ok, parseBody, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { reviewReport } from "@/server/modules/admin/reports.service";

// POST /api/v1/admin/reports/:id/review  { action: DISMISS | RESOLVE | HIDE_LISTING | BLOCK_BUSINESS, note? }  (admin only)
export const POST = route(async (req, ctx: RouteContext<"/api/v1/admin/reports/[id]/review">) => {
  const { user } = await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "REPORT_NOT_FOUND", "Report not found");
  const input = await parseBody(req, reviewReportSchema);
  return ok(await reviewReport(id, user.id, input));
});
