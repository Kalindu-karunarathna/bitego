import { createReportSchema } from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { requireUser } from "@/server/middleware/auth";
import { createReport } from "@/server/modules/reports/reports.service";

// POST /api/v1/reports  { listingId, type, description? }  (any signed-in user except the listing's owner)
export const POST = route(async (req) => {
  const { user } = await requireUser(req);
  const input = await parseBody(req, createReportSchema);
  return ok(await createReport(user.id, input), 201);
});
