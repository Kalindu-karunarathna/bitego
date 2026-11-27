import { ROLES, USER_STATUSES } from "@bitego/shared";
import { z } from "zod";
import { ok, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { listUsers } from "@/server/modules/admin/users.service";

const query = z.object({
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});

// GET /api/v1/admin/users?role=CUSTOMER&status=ACTIVE&q=name-or-email  (admin only, newest first, max 200)
export const GET = route(async (req) => {
  await requireRole(req, "ADMIN");
  const p = req.nextUrl.searchParams;
  const filter = query.parse({
    role: p.get("role") || undefined,
    status: p.get("status") || undefined,
    q: p.get("q") || undefined,
  });
  return ok(await listUsers(filter));
});
