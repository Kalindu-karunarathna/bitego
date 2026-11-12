
import { createReservationSchema } from "@bitego/shared";

import { ApiError, ok, parseBody, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import {
  createReservation,
  listBuyerReservations,
} from "@/server/modules/reservations/reservations.service";

// GET /api/v1/reservations
// Returns the authenticated buyer's reservation history.
export const GET = route(async (req) => {
  const { user } = await requireRole(req, "CUSTOMER", "BUSINESS");

  const reservations = await listBuyerReservations(user.id);

  return ok(reservations);
});

// POST /api/v1/reservations
// Creates a new reservation.
export const POST = route(async (req) => {
  const { user } = await requireRole(req, "CUSTOMER", "BUSINESS");

  const input = await parseBody(req, createReservationSchema);

  const reservation = await createReservation(input, user);

  return ok(reservation, 201);
});
