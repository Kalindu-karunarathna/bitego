import { ACTIVITY_PERIODS } from "@bitego/shared";
import { z } from "zod";
import { ok, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { getActivity } from "@/server/modules/orders/activity.service";

const query = z.object({ period: z.enum(ACTIVITY_PERIODS).default("MONTH") });

// GET /api/v1/seller/activity?period=TODAY|WEEK|MONTH
export const GET = route(async (req) => {
  const { business } = await requireApprovedBusiness(req);
  const { period } = query.parse({ period: req.nextUrl.searchParams.get("period") ?? undefined });
  return ok(await getActivity(business.id, period));
});
