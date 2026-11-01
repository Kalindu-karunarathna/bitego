import { prisma } from "@/lib/prisma";
import { notify } from "@/server/modules/notifications/notify";

// Owner: Sachira. Background job that sends "nearing expiry" alerts to food businesses
// and "pickup reminder" alerts to customers whose reservations are ending soon.

export type ReminderJobResult = {
  nearingExpiryListingsNotified: number;
  pickupRemindersNotified: number;
  timestamp: string;
};

/**
 * Runs the reminder job:
 * 1. Nearing Expiry: Finds active listings expiring within 1 hour, sends LISTING_NEARING_EXPIRY to seller.
 * 2. Pickup Reminder: Finds confirmed reservations whose pickup deadline is within 30 minutes, sends PICKUP_REMINDER to buyer.
 * Deduplicates to prevent sending duplicate reminders on recurring cron runs.
 */
export async function runReminderJob(): Promise<ReminderJobResult> {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);

  let nearingExpiryListingsNotified = 0;
  let pickupRemindersNotified = 0;

  // 1. Listings nearing expiry (pickupEnd > now AND pickupEnd <= now + 1 hour)
  const expiringListings = await prisma.foodListing.findMany({
    where: {
      status: "ACTIVE",
      pickupEnd: {
        gt: now,
        lte: oneHourLater,
      },
    },
    select: {
      id: true,
      title: true,
      pickupEnd: true,
      business: {
        select: {
          ownerId: true,
          name: true,
        },
      },
    },
  });

  for (const listing of expiringListings) {
    const ownerId = listing.business.ownerId;

    // Deduplication check: only send once per listing
    const existing = await prisma.notification.findFirst({
      where: {
        userId: ownerId,
        type: "LISTING_NEARING_EXPIRY",
        listingId: listing.id,
      },
      select: { id: true },
    });

    if (existing) continue;

    const timeStr = listing.pickupEnd.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      await notify({
        userId: ownerId,
        type: "LISTING_NEARING_EXPIRY",
        title: "Listing nearing expiry",
        message: `Your listing "${listing.title}" expires at ${timeStr}. Any unreserved food will be marked expired.`,
        listingId: listing.id,
      });
      nearingExpiryListingsNotified++;
    } catch (err) {
      console.error(`[jobs] Failed to send nearing expiry alert for listing ${listing.id}:`, err);
    }
  }

  // 2. Reservations ending soon (pickupEnd > now AND pickupEnd <= now + 30 min)
  const upcomingReservations = await prisma.reservation.findMany({
    where: {
      status: "CONFIRMED",
      listing: {
        pickupEnd: {
          gt: now,
          lte: thirtyMinutesLater,
        },
      },
    },
    select: {
      id: true,
      buyerId: true,
      pickupCode: true,
      listingId: true,
      listing: {
        select: {
          title: true,
          pickupEnd: true,
          business: {
            select: { name: true },
          },
        },
      },
    },
  });

  for (const res of upcomingReservations) {
    // Deduplication check: only send once per reservation
    const existing = await prisma.notification.findFirst({
      where: {
        userId: res.buyerId,
        type: "PICKUP_REMINDER",
        reservationId: res.id,
      },
      select: { id: true },
    });

    if (existing) continue;

    const timeStr = res.listing.pickupEnd.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      await notify({
        userId: res.buyerId,
        type: "PICKUP_REMINDER",
        title: "Pickup deadline soon",
        message: `Your reservation for "${res.listing.title}" at ${res.listing.business.name} expires at ${timeStr}. Pickup code: ${res.pickupCode}`,
        listingId: res.listingId,
        reservationId: res.id,
      });
      pickupRemindersNotified++;
    } catch (err) {
      console.error(`[jobs] Failed to send pickup reminder for reservation ${res.id}:`, err);
    }
  }

  return {
    nearingExpiryListingsNotified,
    pickupRemindersNotified,
    timestamp: now.toISOString(),
  };
}

