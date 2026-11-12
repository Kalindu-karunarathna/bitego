
import { randomInt } from "node:crypto";
import type { User } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type CreateReservationData = {
  listingId: string;
  quantity: number;
};

type Buyer = Pick<User, "id" | "role">;

function generatePickupCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function createReservation(
  input: CreateReservationData,
  buyer: Buyer,
) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.foodListing.findUnique({
      where: { id: input.listingId },
      include: {
        business: {
          select: {
            ownerId: true,
            status: true,
          },
        },
      },
    });

    if (!listing) {
      throw new ApiError(404, "LISTING_NOT_FOUND", "Food listing not found");
    }

    if (listing.business.ownerId === buyer.id) {
      throw new ApiError(
        403,
        "OWN_LISTING",
        "You cannot reserve your own listing",
      );
    }

    if (listing.business.status !== "ACTIVE") {
      throw new ApiError(
        409,
        "BUSINESS_INACTIVE",
        "This business is not currently active",
      );
    }

    if (listing.status !== "ACTIVE" || listing.pickupEnd <= new Date()) {
      throw new ApiError(
        409,
        "LISTING_UNAVAILABLE",
        "This food listing is no longer available",
      );
    }

    const audienceAllowed =
      listing.audience === "EVERYONE" ||
      (buyer.role === "CUSTOMER" &&
        listing.audience === "CUSTOMERS_ONLY") ||
      (buyer.role === "BUSINESS" &&
        listing.audience === "BUSINESSES_ONLY");

    if (!audienceAllowed) {
      throw new ApiError(
        403,
        "AUDIENCE_RESTRICTED",
        "You are not allowed to reserve this listing",
      );
    }

    if (input.quantity > listing.quantityAvailable) {
      throw new ApiError(
        409,
        "INSUFFICIENT_QUANTITY",
        "The requested quantity is not available",
      );
    }

    // Atomically reduce the available quantity.
    const update = await tx.foodListing.updateMany({
      where: {
        id: listing.id,
        status: "ACTIVE",
        pickupEnd: { gt: new Date() },
        quantityAvailable: { gte: input.quantity },
      },
      data: {
        quantityAvailable: { decrement: input.quantity },
      },
    });

    if (update.count !== 1) {
      throw new ApiError(
        409,
        "INSUFFICIENT_QUANTITY",
        "The listing availability has changed. Please try again",
      );
    }

    // Mark the listing SOLD_OUT when no quantity remains.
    const remaining = await tx.foodListing.findUnique({
      where: { id: listing.id },
      select: { quantityAvailable: true },
    });

    if (remaining?.quantityAvailable === 0) {
      await tx.foodListing.update({
        where: { id: listing.id },
        data: { status: "SOLD_OUT" },
      });
    }

    // Prices are taken from the listing, never from buyer input.
    const unitPrice = listing.price;
    const totalPrice = unitPrice.mul(input.quantity);

    return tx.reservation.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        quantity: input.quantity,
        unitPrice,
        totalPrice,
        pickupCode: generatePickupCode(),
      },
    });
  });
}

export async function listBuyerReservations(buyerId: string) {
  return prisma.reservation.findMany({
    where: { buyerId },
    include: {
      listing: {
        include: {
          business: {
            select: {
              id: true,
              name: true,
              addressLine: true,
              city: true,
              district: true,
              contactNo: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          images: {
            orderBy: { displayOrder: "asc" },
            select: {
              id: true,
              imageUrl: true,
              isPrimary: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function cancelReservation(
  reservationId: string,
  buyerId: string,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        listing: true,
      },
    });

    if (!reservation || reservation.buyerId !== buyerId) {
      throw new ApiError(
        404,
        "RESERVATION_NOT_FOUND",
        "Reservation not found",
      );
    }

    if (reservation.status !== "CONFIRMED") {
      throw new ApiError(
        409,
        "RESERVATION_NOT_CANCELLABLE",
        "Only confirmed reservations can be cancelled",
      );
    }

    const now = new Date();

    if (reservation.listing.pickupEnd <= now) {
      throw new ApiError(
        409,
        "PICKUP_WINDOW_ENDED",
        "This reservation can no longer be cancelled",
      );
    }

    // Only one concurrent action can change CONFIRMED to CANCELLED.
    const changed = await tx.reservation.updateMany({
      where: {
        id: reservationId,
        buyerId,
        status: "CONFIRMED",
      },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelReason: reason?.trim() || null,
      },
    });

    if (changed.count !== 1) {
      throw new ApiError(
        409,
        "RESERVATION_ALREADY_UPDATED",
        "This reservation has already been updated",
      );
    }

    // Restore stock in the same transaction.
    await tx.foodListing.update({
      where: { id: reservation.listingId },
      data: {
        quantityAvailable: {
          increment: reservation.quantity,
        },
      },
    });

    // Reopen a sold-out listing only if its pickup window is still open.
    await tx.foodListing.updateMany({
      where: {
        id: reservation.listingId,
        status: "SOLD_OUT",
        pickupEnd: { gt: now },
      },
      data: {
        status: "ACTIVE",
      },
    });

    return tx.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });
  });
}