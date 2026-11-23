import type {
  AdminReservationPage,
  ReservationStatusFilter,
  ReservationStatus,
} from "@bitego/shared";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Admin: read-only list of every reservation (for disputes and the demo). Newest first, cursor paging.
// Owner: Kalindu. Nothing here changes data.

export async function listReservations(opts: {
  status: ReservationStatusFilter;
  search?: string;
  cursor?: string;
  limit: number;
}): Promise<AdminReservationPage> {
  const q = opts.search?.trim();
  const where: Prisma.ReservationWhereInput = {
    ...(opts.status === "ALL" ? {} : { status: opts.status }),
    ...(q
      ? {
          OR: [
            { pickupCode: { contains: q, mode: "insensitive" } },
            { buyer: { fullName: { contains: q, mode: "insensitive" } } },
            { buyer: { email: { contains: q, mode: "insensitive" } } },
            { listing: { title: { contains: q, mode: "insensitive" } } },
            { listing: { business: { name: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [rows, grouped] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: {
        buyer: { select: { id: true, fullName: true, email: true } },
        listing: { select: { id: true, title: true, business: { select: { id: true, name: true } } } },
      },
    }),
    prisma.reservation.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts = { ALL: 0, CONFIRMED: 0, PICKED_UP: 0, CANCELLED: 0, EXPIRED: 0 } as Record<
    ReservationStatusFilter,
    number
  >;
  for (const g of grouped) {
    counts[g.status as ReservationStatus] = g._count._all;
    counts.ALL += g._count._all;
  }

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return {
    items: page.map((r) => ({
      id: r.id,
      status: r.status,
      quantity: r.quantity,
      totalPrice: Number(r.totalPrice),
      pickupCode: r.pickupCode,
      createdAt: r.createdAt.toISOString(),
      pickedUpAt: r.pickedUpAt?.toISOString() ?? null,
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
      cancelReason: r.cancelReason,
      buyer: r.buyer,
      listing: r.listing,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    counts,
  };
}
