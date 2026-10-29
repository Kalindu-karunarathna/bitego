import { prisma } from "@/lib/prisma";
import { notify } from "@/server/modules/notifications/notify";

// Owner: Sachira. Background job that expires listings and uncollected reservations
// once their pickup window has ended.

export type ExpiryJobResult = {
  expiredListingsCount: number;
  expiredReservationsCount: number;
  timestamp: string;
};

/**
 * Runs the expiry job:
 * 1. Finds all listings where pickupEnd has passed and status is ACTIVE or SOLD_OUT.
 *    Marks them EXPIRED.
 * 2. Finds all reservations where status is CONFIRMED and the listing's pickupEnd has passed.
 *    Marks them EXPIRED (no-show) and notifies the buyer.
 */
export async function runExpiryJob(): Promise<ExpiryJobResult> {
  const now = new Date();

  // 1. Expire past-due listings
  const listingsResult = await prisma.foodListing.updateMany({
    where: {
      pickupEnd: { lte: now },
      status: { in: ["ACTIVE", "SOLD_OUT"] },
    },
    data: {
      status: "EXPIRED",
    },
  });

  // 2. Find confirmed reservations on listings whose pickupEnd has passed
  const expiredReservations = await prisma.reservation.findMany({
    where: {
      status: "CONFIRMED",
      listing: {
        pickupEnd: { lte: now },
      },
    },
    select: {
      id: true,
      buyerId: true,
      listingId: true,
      listing: {
        select: {
          title: true,
        },
      },
    },
  });

  let expiredReservationsCount = 0;

  if (expiredReservations.length > 0) {
    const reservationIds = expiredReservations.map((r) => r.id);

    // Atomically mark all expired reservations
    const updateResult = await prisma.reservation.updateMany({
      where: {
        id: { in: reservationIds },
      },
      data: {
        status: "EXPIRED",
      },
    });

    expiredReservationsCount = updateResult.count;

    // Notify each affected buyer (matching the Figma "Reservation expired" alert)
    const notifications = expiredReservations.map(async (r) => {
      try {
        await notify({
          userId: r.buyerId,
          type: "RESERVATION_CANCELLED",
          title: "Reservation expired",
          message: `Your reservation has expired because the pickup deadline passed.`,
          listingId: r.listingId,
          reservationId: r.id,
        });
      } catch (err) {
        console.error(`[jobs] Failed to notify buyer ${r.buyerId} for expired reservation ${r.id}:`, err);
      }
    });

    await Promise.allSettled(notifications);
  }

  return {
    expiredListingsCount: listingsResult.count,
    expiredReservationsCount,
    timestamp: now.toISOString(),
  };
}

