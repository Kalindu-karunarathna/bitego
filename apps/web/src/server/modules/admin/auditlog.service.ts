import type { AuditLogPage } from "@bitego/shared";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Admin: read the audit log (who changed what). Newest first, cursor paging.
// Rows are written by the admin services (approve/reject, block, category changes).

export async function listAuditLogs(opts: {
  action?: string;
  entityType?: string;
  cursor?: string;
  limit: number;
}): Promise<AuditLogPage> {
  const where: Prisma.AuditLogWhereInput = {
    ...(opts.action ? { action: opts.action } : {}),
    ...(opts.entityType ? { entityType: opts.entityType } : {}),
  };

  const [rows, actionRows] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: { actor: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
  ]);

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  return {
    items: page.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
      actor: r.actor,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    actions: actionRows.map((a) => a.action),
  };
}
