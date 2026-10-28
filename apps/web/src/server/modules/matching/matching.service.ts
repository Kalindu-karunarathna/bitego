import { prisma } from "@/lib/prisma";

// Owner: Sachira. Rule-based matching engine using Haversine distance formula,
// category preferences, audience filtering, and B2B food-safety suitability checks.

export type ListingMatchData = {
  id: string;
  title: string;
  price: number;
  categoryId: string;
  audience: "CUSTOMERS_ONLY" | "BUSINESSES_ONLY" | "EVERYONE";
  businessId: string;
  business: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    ownerId: string;
  };
  category: {
    id: string;
    name: string;
    b2bSuitability: "SUITABLE" | "RESTRICTED" | "UNSUITABLE";
  };
};

export type MatchedUser = {
  userId: string;
  distanceKm: number;
};

/**
 * Calculates the great-circle distance between two points on Earth (in kilometers)
 * using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // Round to 2 decimal places
}

/**
 * Loads a listing along with its business location and category suitability.
 */
export async function loadListingForMatching(
  listingId: string,
): Promise<ListingMatchData | null> {
  const listing = await prisma.foodListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      price: true,
      categoryId: true,
      audience: true,
      businessId: true,
      business: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          ownerId: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          b2bSuitability: true,
        },
      },
    },
  });

  if (!listing) return null;

  return {
    ...listing,
    price: Number(listing.price),
  };
}

/**
 * Finds customer users who should be notified about a new listing:
 * 1. Checks that the listing audience includes customers (CUSTOMERS_ONLY or EVERYONE).
 * 2. Checks user preference: notificationsEnabled must be true.
 * 3. Category preference: if user has favorite categories, the listing's category must match.
 * 4. Distance check: if user provided approximate coordinates, distance must be within notifyRadiusKm.
 */
export async function findNearbyCustomers(
  listing: ListingMatchData,
): Promise<MatchedUser[]> {
  // If audience is businesses only, skip customers
  if (listing.audience === "BUSINESSES_ONLY") {
    return [];
  }

  // Find active customers with their preferences
  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      status: "ACTIVE",
    },
    select: {
      id: true,
      preference: {
        select: {
          notifyRadiusKm: true,
          notificationsEnabled: true,
          approxLatitude: true,
          approxLongitude: true,
          preferredCategories: {
            select: { id: true },
          },
        },
      },
    },
  });

  const matched: MatchedUser[] = [];
  const shopLat = listing.business.latitude;
  const shopLng = listing.business.longitude;

  for (const customer of customers) {
    const pref = customer.preference;

    // 1. If preference row exists and notifications are turned off, skip
    if (pref && !pref.notificationsEnabled) {
      continue;
    }

    // 2. Favorite category filter
    // If the customer selected specific favorite categories, listing must match one of them.
    // If empty, customer receives all categories.
    if (pref && pref.preferredCategories.length > 0) {
      const hasCategory = pref.preferredCategories.some(
        (cat) => cat.id === listing.categoryId,
      );
      if (!hasCategory) continue;
    }

    // 3. Distance check
    const radius = pref?.notifyRadiusKm ?? 3; // Default 3 km if not set
    let distance = 0;

    if (pref?.approxLatitude != null && pref?.approxLongitude != null) {
      distance = calculateDistanceKm(
        shopLat,
        shopLng,
        pref.approxLatitude,
        pref.approxLongitude,
      );
      if (distance > radius) {
        continue;
      }
    }

    matched.push({
      userId: customer.id,
      distanceKm: distance,
    });
  }

  return matched;
}

/**
 * Finds active B2B food businesses nearby:
 * 1. Audience must be BUSINESSES_ONLY or EVERYONE.
 * 2. Category must have b2bSuitability === 'SUITABLE' (food safety rule).
 * 3. Only active, approved businesses.
 * 4. Excludes the business that posted the listing.
 * 5. Within business radius (default 5 km).
 */
export async function findNearbyBusinesses(
  listing: ListingMatchData,
  maxRadiusKm = 5,
): Promise<MatchedUser[]> {
  // 1. Audience check
  if (listing.audience === "CUSTOMERS_ONLY") {
    return [];
  }

  // 2. Food safety guard: B2B suitability check
  if (listing.category.b2bSuitability !== "SUITABLE") {
    return [];
  }

  // 3. Find other active businesses
  const otherBusinesses = await prisma.business.findMany({
    where: {
      status: "ACTIVE",
      id: { not: listing.businessId },
    },
    select: {
      id: true,
      ownerId: true,
      latitude: true,
      longitude: true,
      owner: {
        select: {
          status: true,
          preference: {
            select: {
              notificationsEnabled: true,
            },
          },
        },
      },
    },
  });

  const matched: MatchedUser[] = [];
  const shopLat = listing.business.latitude;
  const shopLng = listing.business.longitude;

  for (const b of otherBusinesses) {
    if (b.owner.status !== "ACTIVE") continue;
    if (b.owner.preference && !b.owner.preference.notificationsEnabled) continue;

    const distance = calculateDistanceKm(shopLat, shopLng, b.latitude, b.longitude);
    if (distance <= maxRadiusKm) {
      matched.push({
        userId: b.ownerId,
        distanceKm: distance,
      });
    }
  }

  return matched;
}

