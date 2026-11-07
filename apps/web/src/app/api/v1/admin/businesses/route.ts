import { BUSINESS_STATUS_FILTERS } from "@bitego/shared";
import { z } from "zod";
import { ok, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { listBusinesses } from "@/server/modules/admin/businesses.service";

const query = z.object({ status: z.enum(BUSINESS_STATUS_FILTERS).default("PENDING") });

// GET /api/v1/admin/businesses?status=PENDING|ACTIVE|REJECTED|SUSPENDED|ALL  (admin only)
export const GET = route(async (req) => {
  await requireRole(req, "ADMIN");
  const { status } = query.parse({ status: req.nextUrl.searchParams.get("status") ?? undefined });
  return ok(await listBusinesses(status));
});
