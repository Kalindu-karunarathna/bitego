
import { cancelReservationSchema } from "@bitego/shared";

import { ApiError, ok, parseBody, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { cancelReservation } from "@/server/modules/reservations/reservations.service";

// PATCH /api/v1/reservations/:id
// Cancels the authenticated buyer's reservation.
export const PATCH = route(async (req, context) => {
  const { user } = await requireRole(req, "CUSTOMER", "BUSINESS");

  const { id } = await (
    context as { params: Promise<{ id: string }> }
  ).params;

  if (!id) {
    throw new ApiError(
      400,
      "INVALID_RESERVATION_ID",
      "Reservation ID is required",
    );
  }

  const input = await parseBody(req, cancelReservationSchema);

  const reservation = await cancelReservation(
    id,
    user.id,
    input.reason,
  );

  return ok(reservation);
});
