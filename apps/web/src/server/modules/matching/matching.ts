import { notify } from "@/server/modules/notifications/notify";
import {
  findNearbyBusinesses,
  findNearbyCustomers,
  loadListingForMatching,
} from "@/server/modules/matching/matching.service";

// CONTRACT. Kajanika calls onListingCreated(listing.id) right after a listing is created.
// Sachira owns the body: finds nearby customers (preferences + distance) and businesses
// (B2B-suitable categories) and notifies them via notify().
// Do NOT change the signature without telling the team.

export async function onListingCreated(listingId: string): Promise<void> {
  try {
    const listing = await loadListingForMatching(listingId);
    if (!listing) {
      console.warn(`[matching] Listing not found for ID: ${listingId}`);
      return;
    }

    // 1. Find matching customers based on location, distance radius, and category preferences
    const matchedCustomers = await findNearbyCustomers(listing);

    // 2. Find matching B2B businesses based on distance and food-safety category suitability
    const matchedBusinesses = await findNearbyBusinesses(listing);

    // Combine and deduplicate users to avoid sending multiple notifications to the same user
    const userMap = new Map<string, number>(); // userId -> distanceKm
    for (const c of matchedCustomers) {
      userMap.set(c.userId, c.distanceKm);
    }
    for (const b of matchedBusinesses) {
      if (!userMap.has(b.userId)) {
        userMap.set(b.userId, b.distanceKm);
      }
    }

    // 3. Send in-app notification to each matched user
    const notifications = Array.from(userMap.entries()).map(async ([userId]) => {
      try {
        await notify({
          userId,
          type: "NEW_NEARBY_LISTING",
          title: "New surplus food nearby",
          message: `${listing.business.name} listed "${listing.title}" for LKR ${listing.price.toFixed(2)}.`,
          listingId: listing.id,
        });
      } catch (err) {
        console.error(`[matching] Failed to notify user ${userId}:`, err);
      }
    });

    await Promise.allSettled(notifications);
  } catch (err) {
    // Matching is an asynchronous background process; errors should never crash the caller
    console.error(`[matching] onListingCreated failed for listing ${listingId}:`, err);
  }
}
