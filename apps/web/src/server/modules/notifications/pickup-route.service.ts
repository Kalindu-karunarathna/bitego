import { z } from "zod";
import { pickupCoordinatesSchema, type PickupRouteInput, type PickupRouteResponse } from "@bitego/shared";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Google returns GeoJSON in longitude, latitude order (the app uses latitude, longitude).
const googleRouteSchema = z.object({
  distanceMeters: z.number().int().nonnegative().default(0),
  duration: z.string().regex(/^\d+(?:\.\d+)?s$/),
  polyline: z.object({ geoJsonLinestring: z.object({
    type: z.literal("LineString"),
    coordinates: z.array(z.tuple([
      z.number().min(-180).max(180), z.number().min(-90).max(90),
    ])).min(2),
  }) }),
});
const googleResponseSchema = z.object({ routes: z.array(googleRouteSchema).default([]) });

/** Read-only routing for the authenticated buyer's active reservation. */
export async function getPickupRoute(userId: string, input: PickupRouteInput): Promise<PickupRouteResponse> {
  const reservation = await prisma.reservation.findFirst({
    where: { id: input.reservationId, buyerId: userId },
    select: { status: true, listing: { select: {
      pickupEnd: true, business: { select: { latitude: true, longitude: true } },
    } } },
  });
  if (!reservation) throw new ApiError(404, "RESERVATION_NOT_FOUND", "Reservation not found.");
  if (reservation.status !== "CONFIRMED" || reservation.listing.pickupEnd <= new Date()) {
    throw new ApiError(409, "PICKUP_UNAVAILABLE", "This reservation is no longer available for pickup.");
  }
  const shop = pickupCoordinatesSchema.safeParse(reservation.listing.business);
  if (!shop.success) throw new ApiError(422, "SHOP_LOCATION_UNAVAILABLE", "The shop location is unavailable.");
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY?.trim();
  if (!apiKey) throw new ApiError(503, "ROUTING_NOT_CONFIGURED", "Pickup routes are temporarily unavailable.");

  // One request per user action; never automatically retry a billable request.
  // No precise customer coordinates or provider responses are stored or logged here.
  const signal = AbortSignal.timeout(10000);
  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST", cache: "no-store", signal,
      headers: {
        "Content-Type": "application/json", "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring",
      },
      body: JSON.stringify({
        origin: { location: { latLng: input.origin } },
        destination: { location: { latLng: shop.data } },
        travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE",
        computeAlternativeRoutes: false, polylineQuality: "OVERVIEW",
        polylineEncoding: "GEO_JSON_LINESTRING",
      }),
    });
    if (!response.ok) {
      throw new ApiError(502, "ROUTING_UNAVAILABLE", "Could not load the pickup route. Please try again.");
    }
    const parsed = googleResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new ApiError(502, "INVALID_ROUTE", "The route could not be read. Please try again.");
    const first = parsed.data.routes[0];
    if (!first) throw new ApiError(404, "ROUTE_NOT_FOUND", "No driving route was found to this shop.");
    const durationSeconds = Number(first.duration.slice(0, -1));
    if (!Number.isFinite(durationSeconds)) throw new ApiError(502, "INVALID_ROUTE", "The route could not be read. Please try again.");
    return {
      destination: shop.data,
      coordinates: first.polyline.geoJsonLinestring.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
      distanceMeters: first.distanceMeters, durationSeconds,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal.aborted) throw new ApiError(504, "ROUTING_TIMEOUT", "The route request timed out. Please try again.");
    // Do not expose provider details, credentials, or customer location in API errors.
    throw new ApiError(502, "ROUTING_UNAVAILABLE", "Could not load the pickup route. Please try again.");
  }
}
