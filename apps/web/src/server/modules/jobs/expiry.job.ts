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
 * Expires past-due ACTIVE/SOLD_OUT listings and CONFIRMED reservations.
 * Only reservations changed by this run are counted and notified.
 */
export async function runExpiryJob(): Promise<ExpiryJobResult> {
  const now = new Date();

  const listingsResult = await prisma.foodListing.updateMany({
    where: {
      pickupEnd: { lte: now },
      status: { in: ["ACTIVE", "SOLD_OUT"] },
    },
    data: {
      status: "EXPIRED",
    },
  });

  // Check eligibility in the write itself, so a pickup/cancellation that wins
  // the race is preserved. RETURNING identifies exactly the rows this run changed;
  // another expiry run cannot claim those rows again.
  const expiredReservations = await prisma.reservation.updateManyAndReturn({
    where: {
      status: "CONFIRMED",
      listing: {
        pickupEnd: { lte: now },
      },
    },
    data: {
      status: "EXPIRED",
    },
    select: {
      id: true,
      buyerId: true,
      listingId: true,
    },
  });

  await Promise.allSettled(expiredReservations.map(async (reservation) => {
    try {
      await notify({
        userId: reservation.buyerId,
        type: "RESERVATION_CANCELLED",
        title: "Reservation expired",
        message: "Your reservation has expired because the pickup deadline passed.",
        listingId: reservation.listingId,
        reservationId: reservation.id,
      });
    } catch (err) {
      console.error(`[jobs] Failed to notify buyer ${reservation.buyerId} for expired reservation ${reservation.id}:`, err);
    }
  }));

  return {
    expiredListingsCount: listingsResult.count,
    expiredReservationsCount: expiredReservations.length,
    timestamp: now.toISOString(),
  };
}
