import { ANALYTICS_RANGES } from "@bitego/shared";
import { z } from "zod";
import { ok, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { getAnalytics } from "@/server/modules/admin/analytics.service";

const query = z.object({
  days: z.coerce
    .number()
    .refine((n) => (ANALYTICS_RANGES as readonly number[]).includes(n), "days must be 7, 30 or 90")
    .default(30),
});

// GET /api/v1/admin/analytics?days=7|30|90  (admin only)
export const GET = route(async (req) => {
  await requireRole(req, "ADMIN");
  const { days } = query.parse({ days: req.nextUrl.searchParams.get("days") ?? undefined });
  return ok(await getAnalytics(days));
});
