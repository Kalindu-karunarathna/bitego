import { fetchPickupRoute } from "@/api/notifications";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import {
  validPickupCoordinates,
  validatePickupRoute,
  waitForPickupResult,
  type PickupCoordinates,
  type PickupRoute,
  type PickupRouteLoader,
} from "./pickupRoute";

export type PickupRouteOptions = {
  reservationId?: string;
  latitude: number;
  longitude: number;
  userLatitude?: number;
  userLongitude?: number;
  loadRoute?: PickupRouteLoader;
};

type RouteState = {
  key: string;
  loader?: PickupRouteLoader;
  status: "locating" | "routing" | "ready" | "error";
  origin: PickupCoordinates | null;
  route: PickupRoute | null;
  message: string | null;
};

// Each mounted order owns its request. Cleanup prevents late GPS/network responses
// from putting another order's route into the current map.
export function usePickupRoute({
  reservationId, latitude, longitude, userLatitude, userLongitude, loadRoute: customLoader,
}: PickupRouteOptions) {
  const defaultLoader = useCallback<PickupRouteLoader>(async ({ origin }) => {
    if (!reservationId) throw new Error("Select a reservation to see its pickup route.");
    return fetchPickupRoute({ reservationId, origin });
  }, [reservationId]);
  const loadRoute = customLoader ?? defaultLoader;
  const [revision, setRevision] = useState(0);
  const [stored, setStored] = useState<RouteState | null>(null);
  const key = [reservationId, latitude, longitude, userLatitude, userLongitude, revision].map(String).join("|");
  const retry = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let origin: PickupCoordinates | null = null;
    const update = (state: Omit<RouteState, "key" | "loader">) => {
      if (active) setStored({ ...state, key, loader: loadRoute });
    };
    async function run() {
      await Promise.resolve();
      if (!active) return;
      try {
        const destination = { latitude, longitude };
        if (!validPickupCoordinates(destination)) throw new Error("The shop location is unavailable.");
        if (userLatitude !== undefined || userLongitude !== undefined) {
          const supplied = { latitude: userLatitude, longitude: userLongitude };
          if (!validPickupCoordinates(supplied)) throw new Error("Your location is unavailable. Please refresh it.");
          origin = supplied;
        } else {
          const permission = await waitForPickupResult(
            Location.requestForegroundPermissionsAsync(), controller.signal, 30000,
            "Location permission is taking too long. Please try again.",
          );
          if (!active) return;
          if (permission.status !== "granted") {
            throw new Error("Allow location access in your device settings to see the pickup route.");
          }
          const position = await waitForPickupResult(
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            controller.signal, 20000, "Could not find your current location. Please try again.",
          );
          if (!active) return;
          const current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          if (!validPickupCoordinates(current)) throw new Error("Your current location is unavailable.");
          origin = current;
        }
        update({ status: "routing", origin, route: null, message: null });
        const result = await waitForPickupResult(
          loadRoute({ origin, destination, signal: controller.signal }),
          controller.signal, 15000, "The route request timed out. Please try again.",
        );
        if (!active) return;
        update({ status: "ready", origin, route: validatePickupRoute(result), message: null });
      } catch (error) {
        if (!active) return;
        controller.abort();
        update({ status: "error", origin, route: null,
          message: error instanceof Error ? error.message : "Could not load the pickup route. Please try again." });
      }
    }
    void run();
    return () => { active = false; controller.abort(); };
  }, [key, latitude, longitude, userLatitude, userLongitude, loadRoute]);

  // Hide a previous order's route immediately, before effect cleanup runs.
  const current: RouteState = stored?.key === key && stored.loader === loadRoute ? stored : {
    key, loader: loadRoute, status: "locating", origin: null, route: null, message: null,
  };
  return { ...current, retry };
}
