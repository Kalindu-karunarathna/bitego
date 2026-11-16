import { Linking, Platform } from "react-native";
import { validPickupCoordinates } from "./pickupRoute";

// Owner: Sachira. Location and routing utility helpers for business map previews and notifications.

export type Coordinates = {
  latitude: number;
  longitude: number;
};

/**
 * Calculates the great-circle distance between two points in kilometers using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats a distance in kilometers into a human-readable string (e.g. "450 m" or "2.3 km").
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export type TravelTimeEstimate = {
  driveMinutes: number;
  walkMinutes: number;
};

/**
 * Estimates travel time for driving (avg 25 km/h in urban areas) and walking (avg 4.8 km/h).
 */
export function estimateTravelTimes(distanceKm: number): TravelTimeEstimate {
  const driveMinutes = Math.max(1, Math.round((distanceKm / 25) * 60));
  const walkMinutes = Math.max(1, Math.round((distanceKm / 4.8) * 60));

  return { driveMinutes, walkMinutes };
}

export type DirectionsOptions = {
  latitude: number;
  longitude: number;
  userLatitude?: number;
  userLongitude?: number;
};

/** Google Maps directions, with the same driving mode and coordinates as the preview. */
export function buildGoogleMapsDirectionsUrl({
  latitude, longitude, userLatitude, userLongitude,
}: DirectionsOptions): string {
  if (!validPickupCoordinates({ latitude, longitude })) {
    throw new Error("The shop location is unavailable.");
  }
  const destination = encodeURIComponent(latitude + "," + longitude);
  let origin = "";
  if (userLatitude !== undefined || userLongitude !== undefined) {
    if (!validPickupCoordinates({ latitude: userLatitude, longitude: userLongitude })) {
      throw new Error("Your location is unavailable. Please refresh it.");
    }
    origin = "&origin=" + encodeURIComponent(userLatitude + "," + userLongitude);
  }
  // Without coordinates, Google uses current location or asks for a starting point.
  return "https://www.google.com/maps/dir/?api=1&destination=" + destination + origin + "&travelmode=driving";
}

/** Universal HTTPS links open Google Maps with its browser fallback on iOS and Android. */
export async function openDirectionsInMaps(options: DirectionsOptions): Promise<void> {
  const url = buildGoogleMapsDirectionsUrl(options);
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") throw new Error("Browser is unavailable");
      // Same-tab navigation avoids popup blockers and preserves browser Back.
      // Dispatch directly from the click; do not await GPS or a network request.
      window.location.assign(url);
      return;
    }
    await Linking.openURL(url);
  } catch {
    throw new Error("Could not open Google Maps. Please try again.");
  }
}
