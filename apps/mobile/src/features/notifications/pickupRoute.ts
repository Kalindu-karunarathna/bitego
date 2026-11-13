// Owner: Sachira. Provider-independent pickup route contract and validation.
export type PickupCoordinates = { latitude: number; longitude: number };

export type PickupRoute = {
  destination: PickupCoordinates;
  coordinates: PickupCoordinates[];
  distanceMeters: number;
  durationSeconds: number;
};

export type PickupRouteRequest = {
  origin: PickupCoordinates;
  destination: PickupCoordinates;
  signal: AbortSignal;
};

export type PickupRouteLoader = (request: PickupRouteRequest) => Promise<PickupRoute>;

export function validPickupCoordinates(value: unknown): value is PickupCoordinates {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<PickupCoordinates>;
  return typeof point.latitude === "number" && Number.isFinite(point.latitude) &&
    point.latitude >= -90 && point.latitude <= 90 &&
    typeof point.longitude === "number" && Number.isFinite(point.longitude) &&
    point.longitude >= -180 && point.longitude <= 180;
}

/** Reject incomplete responses instead of drawing an invented straight-line route. */
export function validatePickupRoute(value: unknown): PickupRoute {
  if (!value || typeof value !== "object") throw new Error("The route could not be read. Please try again.");
  const route = value as Partial<PickupRoute>;
  if (!validPickupCoordinates(route.destination) || !Array.isArray(route.coordinates) || route.coordinates.length < 2 ||
      !route.coordinates.every(validPickupCoordinates) ||
      typeof route.distanceMeters !== "number" || !Number.isFinite(route.distanceMeters) || route.distanceMeters < 0 ||
      typeof route.durationSeconds !== "number" || !Number.isFinite(route.durationSeconds) || route.durationSeconds < 0) {
    throw new Error("The route could not be read. Please try again.");
  }
  return { destination: route.destination, coordinates: route.coordinates, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds };
}

/** Bound GPS/provider waits and ignore results after unmount or order changes. */
export function waitForPickupResult<T>(
  task: Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", aborted); };
    const aborted = () => { cleanup(); reject(new Error("Pickup request cancelled")); };
    // Always attach handlers, even if already cancelled, to consume late rejections.
    task.then((result) => { cleanup(); resolve(result); }, (error) => { cleanup(); reject(error); });
    if (signal.aborted) { aborted(); return; }
    signal.addEventListener("abort", aborted, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error(timeoutMessage)); }, timeoutMs);
  });
}
