import { Linking, Platform } from "react-native";

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

/**
 * Launches the device's native mapping application (Apple Maps on iOS, Google Maps on Android),
 * or falls back to Google Maps web directions.
 */
export async function openDirectionsInMaps({
  latitude,
  longitude,
  name,
}: {
  latitude: number;
  longitude: number;
  name?: string;
}): Promise<void> {
  const label = name ? encodeURIComponent(name) : "Food Location";
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.open(webUrl, "_blank");
    }
    return;
  }

  const nativeScheme = Platform.select({
    ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
    android: `geo:0,0?q=${latitude},${longitude}(${label})`,
  });

  if (nativeScheme) {
    try {
      const canOpen = await Linking.canOpenURL(nativeScheme);
      if (canOpen) {
        await Linking.openURL(nativeScheme);
        return;
      }
    } catch {
      // Fallback below
    }
  }

  await Linking.openURL(webUrl);
}

