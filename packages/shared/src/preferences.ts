import { z } from "zod";

// Types and zod schemas for the "preferences" API, shared by the web backend and the mobile app. Owner: Sachira.
// Add them here, not in index.ts (index.ts already exports this file).

// ─────────────────────────── Response shapes ───────────────────────────

/** A single category as returned inside preferences (matches GET /categories shape). */
export type PreferenceCategory = {
  id: string;
  name: string;
};

/** GET /api/v1/preferences */
export type UserPreferencesResponse = {
  notifyRadiusKm: number;
  notificationsEnabled: boolean;
  /** Rounded to ~1 km (2 decimal places) for privacy. Null if the user has not set a location. */
  approxLatitude: number | null;
  approxLongitude: number | null;
  locationUpdatedAt: string | null; // ISO 8601
  preferredCategories: PreferenceCategory[];
};

// ─────────────────────────── Request schemas ───────────────────────────

/** PUT /api/v1/preferences */
export const updatePreferencesSchema = z.object({
  /** Notification radius in km. 1–50. */
  notifyRadiusKm: z.number().int().min(1).max(50).optional(),
  notificationsEnabled: z.boolean().optional(),
  /**
   * Approximate latitude. The API rounds this to 2 decimal places (~1 km)
   * before storing it, so the exact location is never persisted.
   * Send null to clear the saved location.
   */
  approxLatitude: z.number().min(-90).max(90).nullable().optional(),
  approxLongitude: z.number().min(-180).max(180).nullable().optional(),
  /**
   * Full list of preferred category IDs (replaces the previous list).
   * Send an empty array [] to clear all preferences.
   */
  preferredCategoryIds: z.array(z.string().uuid()).max(20).optional(),
});
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
