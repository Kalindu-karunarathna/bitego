import type { AdminAnalyticsDto } from "@bitego/shared";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Admin dashboard numbers. Read-only: it only counts what the other modules wrote.
// "Rescued" means a reservation that reached PICKED_UP. Days are Sri Lanka time (UTC+05:30, no daylight saving).

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" });

function lastDays(n: number): string[] {
  const now = Date.now();
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) days.push(dayFormat.format(new Date(now - i * 86_400_000)));
  return days;
}

const toMap = <K extends string>(rows: { key: K; n: number }[]) => new Map(rows.map((r) => [r.key, r.n]));

export async function getAnalytics(rangeDays: number): Promise<AdminAnalyticsDto> {
  const days = lastDays(rangeDays);
  const since = new Date(`${days[0]}T00:00:00+05:30`);

  const [userRows, businessRows, listingRows, reservationRows, impact, dailyRows, topRows] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.business.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.foodListing.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.reservation.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.reservation.aggregate({
      where: { status: "PICKED_UP", createdAt: { gte: since } },
      _sum: { quantity: true, totalPrice: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ day: string; reserved: number; picked_up: number }[]>(Prisma.sql`
      SELECT to_char((created_at AT TIME ZONE 'Asia/Colombo')::date, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS reserved,
             (COUNT(*) FILTER (WHERE status = 'PICKED_UP'))::int AS picked_up
      FROM reservations
      WHERE created_at >= ${since}
      GROUP BY 1`),
    prisma.$queryRaw<{ id: string; name: string; city: string; items: number; pickups: number }[]>(Prisma.sql`
      SELECT b.id, b.name, b.city,
             COALESCE(SUM(r.quantity), 0)::int AS items,
             COUNT(r.id)::int AS pickups
      FROM reservations r
      JOIN food_listings l ON l.id = r.listing_id
      JOIN businesses b ON b.id = l.business_id
      WHERE r.status = 'PICKED_UP' AND r.created_at >= ${since}
      GROUP BY b.id, b.name, b.city
      ORDER BY items DESC, pickups DESC
      LIMIT 5`),
  ]);

  const users = toMap(userRows.map((r) => ({ key: r.role, n: r._count._all })));
  const businesses = toMap(businessRows.map((r) => ({ key: r.status, n: r._count._all })));
  const listings = toMap(listingRows.map((r) => ({ key: r.status, n: r._count._all })));
  const reservations = toMap(reservationRows.map((r) => ({ key: r.status, n: r._count._all })));
  const byDay = new Map(dailyRows.map((r) => [r.day, r]));

  return {
    rangeDays,
    users: { customers: users.get("CUSTOMER") ?? 0, businesses: users.get("BUSINESS") ?? 0, admins: users.get("ADMIN") ?? 0 },
    businesses: {
      pending: businesses.get("PENDING") ?? 0,
      active: businesses.get("ACTIVE") ?? 0,
      rejected: businesses.get("REJECTED") ?? 0,
      suspended: businesses.get("SUSPENDED") ?? 0,
    },
    listings: {
      active: listings.get("ACTIVE") ?? 0,
      soldOut: listings.get("SOLD_OUT") ?? 0,
      completed: listings.get("COMPLETED") ?? 0,
      expired: listings.get("EXPIRED") ?? 0,
      cancelled: listings.get("CANCELLED") ?? 0,
    },
    reservations: {
      total: [...reservations.values()].reduce((a, b) => a + b, 0),
      confirmed: reservations.get("CONFIRMED") ?? 0,
      pickedUp: reservations.get("PICKED_UP") ?? 0,
      cancelled: reservations.get("CANCELLED") ?? 0,
      expired: reservations.get("EXPIRED") ?? 0,
    },
    impact: {
      itemsRescued: impact._sum.quantity ?? 0,
      completedPickups: impact._count._all,
      revenueRecovered: Number(impact._sum.totalPrice ?? 0),
    },
    daily: days.map((date) => ({ date, reserved: byDay.get(date)?.reserved ?? 0, pickedUp: byDay.get(date)?.picked_up ?? 0 })),
    topBusinesses: topRows.map((r) => ({ businessId: r.id, name: r.name, city: r.city, itemsRescued: r.items, pickups: r.pickups })),
  };
}
