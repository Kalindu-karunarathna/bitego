
import type { User } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Buyer = Pick<User, "id" | "role">;

type CreateReviewData = {
  reservationId: string;
  rating: number;
  comment?: string;
};

export async function createReview(
  input: CreateReviewData,
  buyer: Buyer,
) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: input.reservationId },
      include: {
        listing: {
          select: {
            businessId: true,
          },
        },
        review: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!reservation || reservation.buyerId !== buyer.id) {
      throw new ApiError(
        404,
        "RESERVATION_NOT_FOUND",
        "Reservation not found",
      );
    }

    if (reservation.status !== "PICKED_UP") {
      throw new ApiError(
        409,
        "RESERVATION_NOT_PICKED_UP",
        "You can only review food after pickup",
      );
    }

    if (reservation.review) {
      throw new ApiError(
        409,
        "REVIEW_ALREADY_EXISTS",
        "You have already reviewed this reservation",
      );
    }

    return tx.review.create({
      data: {
        reservationId: reservation.id,
        reviewerId: buyer.id,
        businessId: reservation.listing.businessId,
        rating: input.rating,
        comment: input.comment?.trim() || null,
      },
    });
  });
}

export async function getBuyerReviewedReservationIds(buyer: Buyer) {
  const reviews = await prisma.review.findMany({
    where: {
      reviewerId: buyer.id,
    },
    select: {
      reservationId: true,
    },
  });

  return reviews.map((review) => review.reservationId);
}