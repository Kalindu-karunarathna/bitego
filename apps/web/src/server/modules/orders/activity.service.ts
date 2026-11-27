import type { ActivityPeriod, SellerActivityDto } from "@bitego/shared";
import { prisma } from "@/lib/prisma";

// A business's surplus impact for the Activity screen. Owner: Kajanika.
// Days follow Sri Lanka time (UTC+05:30), like the admin analytics.

const OFFSET_MS = 5.5 * 3600000;
const DAY_MS = 86400000;

// Midnight in Sri Lanka, as a real timestamp.
function startOfLocalDay(time: number) {
  return Math.floor((time + OFFSET_MS) / DAY_MS) * DAY_MS - OFFSET_MS;
}

function periodStart(period: ActivityPeriod, now: number) {
  const today = startOfLocalDay(now);
  if (period === "TODAY") return today;
  if (period === "WEEK") return today - 6 * DAY_MS;
  const local = new Date(now + OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET_MS;
}

const localDate = (time: number) => new Date(time + OFFSET_MS).toISOString().slice(0, 10);

export async function getActivity(businessId: string, period: ActivityPeriod): Promise<SellerActivityDto> {
  const now = Date.now();
  const start = periodStart(period, now);
  const previousStart = start - (now - start);
  const chartStart = startOfLocalDay(now) - 6 * DAY_MS;
  const since = new Date(Math.min(previousStart, chartStart));

  const [reservations, listingsCreated, previousListingsCreated] = await Promise.all([
    prisma.reservation.findMany({
      where: { listing: { businessId }, OR: [{ createdAt: { gte: since } }, { pickedUpAt: { gte: since } }] },
      select: {
        quantity: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        pickedUpAt: true,
        listing: { select: { title: true } },
      },
      take: 20000,
    }),
    prisma.foodListing.count({ where: { businessId, createdAt: { gte: new Date(start) } } }),
    prisma.foodListing.count({ where: { businessId, createdAt: { gte: new Date(previousStart), lt: new Date(start) } } }),
  ]);

  const createdIn = (from: number, to: number) =>
    reservations.filter((r) => r.createdAt.getTime() >= from && r.createdAt.getTime() < to);
  const pickedUpIn = (from: number, to: number) =>
    reservations.filter((r) => r.status === "PICKED_UP" && r.pickedUpAt && r.pickedUpAt.getTime() >= from && r.pickedUpAt.getTime() < to);
  const sumQty = (rows: typeof reservations) => rows.reduce((sum, r) => sum + r.quantity, 0);
  const sumMoney = (rows: typeof reservations) => Math.round(rows.reduce((sum, r) => sum + Number(r.totalPrice), 0) * 100) / 100;

  const created = createdIn(start, now + 1);
  const notCancelled = created.filter((r) => r.status !== "CANCELLED");
  const collected = pickedUpIn(start, now + 1);
  const previousCollected = pickedUpIn(previousStart, start);
  const reservedQty = sumQty(notCancelled);
  const collectedOfReserved = sumQty(notCancelled.filter((r) => r.status === "PICKED_UP"));

  const byListing = new Map<string, { title: string; portions: number; revenue: number }>();
  for (const r of collected) {
    const entry = byListing.get(r.listing.title) ?? { title: r.listing.title, portions: 0, revenue: 0 };
    entry.portions += r.quantity;
    entry.revenue = Math.round((entry.revenue + Number(r.totalPrice)) * 100) / 100;
    byListing.set(r.listing.title, entry);
  }

  return {
    period,
    listingsCreated,
    previousListingsCreated,
    portionsReserved: reservedQty,
    portionsCollected: sumQty(collected),
    previousPortionsCollected: sumQty(previousCollected),
    portionsAwaiting: sumQty(created.filter((r) => r.status === "CONFIRMED")),
    portionsCancelled: sumQty(created.filter((r) => r.status === "CANCELLED")),
    revenue: sumMoney(collected),
    previousRevenue: sumMoney(previousCollected),
    completionRate: reservedQty > 0 ? Math.round((collectedOfReserved / reservedQty) * 100) : null,
    last7Days: Array.from({ length: 7 }, (_, i) => {
      const from = chartStart + i * DAY_MS;
      return { date: localDate(from), collected: sumQty(pickedUpIn(from, from + DAY_MS)) };
    }),
    revenueByListing: [...byListing.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  };
}
