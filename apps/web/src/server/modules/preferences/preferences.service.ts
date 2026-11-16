import type { UpdatePreferencesInput, UserPreferencesResponse } from "@bitego/shared";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Preferences service: manages user notification settings, matching radius,
// preferred categories, and optional approximate location (~1 km resolution).

const PREFERENCE_SELECT = {
  notifyRadiusKm: true,
  notificationsEnabled: true,
  approxLatitude: true,
  approxLongitude: true,
  locationUpdatedAt: true,
  preferredCategories: {
    select: { id: true, name: true },
  },
} as const;

/**
 * Gets preferences for a user.
 * If the user has not saved preferences yet, returns default values.
 */
export async function getPreferences(userId: string): Promise<UserPreferencesResponse> {
  const pref = await prisma.userPreference.findUnique({
    where: { userId },
    select: PREFERENCE_SELECT,
  });

  if (!pref) {
    return {
      notifyRadiusKm: 3,
      notificationsEnabled: true,
      approxLatitude: null,
      approxLongitude: null,
      locationUpdatedAt: null,
      preferredCategories: [],
    };
  }

  return {
    notifyRadiusKm: pref.notifyRadiusKm,
    notificationsEnabled: pref.notificationsEnabled,
    approxLatitude: pref.approxLatitude,
    approxLongitude: pref.approxLongitude,
    locationUpdatedAt: pref.locationUpdatedAt ? pref.locationUpdatedAt.toISOString() : null,
    preferredCategories: pref.preferredCategories,
  };
}

/**
 * Creates or updates preferences for a user.
 * Coordinates are rounded to 2 decimal places (~1.1 km) before storing to protect user privacy.
 */
export async function updatePreferences(
  userId: string,
  input: UpdatePreferencesInput,
): Promise<UserPreferencesResponse> {
  let uniqueCategoryIds: string[] | undefined = undefined;

  if (input.preferredCategoryIds !== undefined) {
    uniqueCategoryIds = Array.from(new Set(input.preferredCategoryIds));
    if (uniqueCategoryIds.length > 0) {
      const existingCount = await prisma.category.count({
        where: { id: { in: uniqueCategoryIds } },
      });
      if (existingCount !== uniqueCategoryIds.length) {
        throw new ApiError(404, "CATEGORY_NOT_FOUND", "One or more categories do not exist");
      }
    }
  }

  // Location rounding & updates
  let approxLatitudeUpdate: number | null | undefined = undefined;
  let approxLongitudeUpdate: number | null | undefined = undefined;
  let locationUpdatedAtUpdate: Date | null | undefined = undefined;

  if (input.approxLatitude === null || input.approxLongitude === null) {
    approxLatitudeUpdate = null;
    approxLongitudeUpdate = null;
    locationUpdatedAtUpdate = null;
  } else if (typeof input.approxLatitude === "number" && typeof input.approxLongitude === "number") {
    // Round to 2 decimal places (~1.1 km)
    approxLatitudeUpdate = Math.round(input.approxLatitude * 100) / 100;
    approxLongitudeUpdate = Math.round(input.approxLongitude * 100) / 100;
    locationUpdatedAtUpdate = new Date();
  }

  const updated = await prisma.userPreference.upsert({
    where: { userId },
    update: {
      ...(input.notifyRadiusKm !== undefined ? { notifyRadiusKm: input.notifyRadiusKm } : {}),
      ...(input.notificationsEnabled !== undefined ? { notificationsEnabled: input.notificationsEnabled } : {}),
      ...(approxLatitudeUpdate !== undefined ? { approxLatitude: approxLatitudeUpdate } : {}),
      ...(approxLongitudeUpdate !== undefined ? { approxLongitude: approxLongitudeUpdate } : {}),
      ...(locationUpdatedAtUpdate !== undefined ? { locationUpdatedAt: locationUpdatedAtUpdate } : {}),
      ...(uniqueCategoryIds !== undefined
        ? {
            preferredCategories: {
              set: uniqueCategoryIds.map((id) => ({ id })),
            },
          }
        : {}),
    },
    create: {
      user: { connect: { id: userId } },
      notifyRadiusKm: input.notifyRadiusKm ?? 3,
      notificationsEnabled: input.notificationsEnabled ?? true,
      approxLatitude: approxLatitudeUpdate ?? null,
      approxLongitude: approxLongitudeUpdate ?? null,
      locationUpdatedAt: locationUpdatedAtUpdate ?? null,
      ...(uniqueCategoryIds !== undefined && uniqueCategoryIds.length > 0
        ? {
            preferredCategories: {
              connect: uniqueCategoryIds.map((id) => ({ id })),
            },
          }
        : {}),
    },
    select: PREFERENCE_SELECT,
  });

  return {
    notifyRadiusKm: updated.notifyRadiusKm,
    notificationsEnabled: updated.notificationsEnabled,
    approxLatitude: updated.approxLatitude,
    approxLongitude: updated.approxLongitude,
    locationUpdatedAt: updated.locationUpdatedAt ? updated.locationUpdatedAt.toISOString() : null,
    preferredCategories: updated.preferredCategories,
  };
}

