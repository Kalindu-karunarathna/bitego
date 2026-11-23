import { RESERVATION_STATUS_FILTERS } from "@bitego/shared";
import { z } from "zod";
import { ok, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { listReservations } from "@/server/modules/admin/reservations.service";

const query = z.object({
  status: z.enum(RESERVATION_STATUS_FILTERS).default("ALL"),
  search: z.string().trim().min(1).max(80).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// GET /api/v1/admin/reservations?status=ALL|CONFIRMED|PICKED_UP|CANCELLED|EXPIRED&search=&cursor=&limit=30
// Admin only, read-only, newest first. `search` matches pickup code, buyer, listing or business.
export const GET = route(async (req) => {
  await requireRole(req, "ADMIN");
  const p = req.nextUrl.searchParams;
  const input = query.parse({
    status: p.get("status") || undefined,
    search: p.get("search") || undefined,
    cursor: p.get("cursor") || undefined,
    limit: p.get("limit") || undefined,
  });
  return ok(await listReservations(input));
});
