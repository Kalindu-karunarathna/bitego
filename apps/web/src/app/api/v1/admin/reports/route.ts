import { REPORT_STATUS_FILTERS } from "@bitego/shared";
import { z } from "zod";
import { ok, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { listReports } from "@/server/modules/admin/reports.service";

const query = z.object({ status: z.enum(REPORT_STATUS_FILTERS).default("PENDING") });

// GET /api/v1/admin/reports?status=PENDING|RESOLVED|REJECTED|ALL  (admin only, max 200)
export const GET = route(async (req) => {
  await requireRole(req, "ADMIN");
  const { status } = query.parse({ status: req.nextUrl.searchParams.get("status") || undefined });
  return ok(await listReports(status));
});
