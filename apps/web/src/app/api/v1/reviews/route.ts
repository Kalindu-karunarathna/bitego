import { createReviewSchema } from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { requireBuyer } from "@/server/modules/buyer/buyer-auth";
import {
  createReview,
  getBuyerReviewedReservationIds,
} from "@/server/modules/reviews/reviews.service";

// GET /api/v1/reviews
// Get reservation IDs already reviewed by the current buyer.
export const GET = route(async (req) => {
  const { user } = await requireBuyer(req);

  const reservationIds = await getBuyerReviewedReservationIds(user);

  return ok({ reservationIds });
});

// POST /api/v1/reviews
// Submit a review after successful pickup.
export const POST = route(async (req) => {
  const { user } = await requireBuyer(req);

  const input = await parseBody(req, createReviewSchema);

  const review = await createReview(input, user);

  return ok(review, 201);
});