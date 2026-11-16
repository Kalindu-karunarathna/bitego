
import { apiFetch } from "@/api/client";

export type CreateReviewInput = {
  reservationId: string;
  rating: number;
  comment?: string;
};

export type Review = {
  id: string;
  reservationId: string;
  reviewerId: string;
  businessId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

type ReviewedReservationsResponse = {
  reservationIds: string[];
};

export async function getBuyerReviewedReservationIds(): Promise<string[]> {
  const response = await apiFetch<ReviewedReservationsResponse>("/reviews", {
    method: "GET",
  });

  return response.reservationIds;
}

export async function createBuyerReview(
  input: CreateReviewInput,
): Promise<Review> {
  return apiFetch<Review>("/reviews", {
    method: "POST",
    body: {
      reservationId: input.reservationId,
      rating: input.rating,
      ...(input.comment?.trim()
        ? { comment: input.comment.trim() }
        : {}),
    },
  });
}
