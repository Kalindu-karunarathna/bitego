import { z } from "zod";
import { ok, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { listAuditLogs } from "@/server/modules/admin/auditlog.service";

const query = z.object({
  action: z.string().trim().min(1).max(60).optional(),
  entityType: z.string().trim().min(1).max(60).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// GET /api/v1/admin/audit-logs?action=&entityType=&cursor=&limit=30  (admin only, newest first)
export const GET = route(async (req) => {
  await requireRole(req, "ADMIN");
  const p = req.nextUrl.searchParams;
  const input = query.parse({
    action: p.get("action") || undefined,
    entityType: p.get("entityType") || undefined,
    cursor: p.get("cursor") || undefined,
    limit: p.get("limit") || undefined,
  });
  return ok(await listAuditLogs(input));
});
