import type { UpdatePreferencesInput, UserPreferencesResponse } from "@bitego/shared";
import { apiFetch } from "@/api/client";

// Owner: Sachira. Talks to the backend preferences API (/api/v1/preferences).

/**
 * Fetches the notification preferences for the authenticated user.
 */
export function fetchPreferences(): Promise<UserPreferencesResponse> {
  return apiFetch<UserPreferencesResponse>("/preferences");
}

/**
 * Updates notification radius, toggle, approximate location, or preferred categories.
 */
export function updatePreferences(input: UpdatePreferencesInput): Promise<UserPreferencesResponse> {
  return apiFetch<UserPreferencesResponse>("/preferences", {
    method: "PUT",
    body: input,
  });
}

