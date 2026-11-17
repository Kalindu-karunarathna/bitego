
import { randomInt } from "node:crypto";
import type { User } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/modules/notifications/notify";

type CreateReservationData = {
  listingId: string;
  quantity: number;
};

type Buyer = Pick<User, "id" | "role">;

const MAX_PICKUP_CODE_ATTEMPTS = 3;

function generatePickupCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function getUniqueConstraintTarget(error: unknown): string {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== "P2002" ||
    !("meta" in error)
  ) {
    return "";
  }

  const meta = error.meta;

  if (typeof meta !== "object" || meta === null || !("target" in meta)) {
    return "";
  }

  const target = meta.target;

  return Array.isArray(target)
    ? target.join(",").toLowerCase()
    : typeof target === "string"
      ? target.toLowerCase()
      : "";
}

function isPickupCodeCollision(error: unknown): boolean {
  const target = getUniqueConstraintTarget(error);

  return (
    target.includes("pickupcode") ||
    target.includes("pickup_code")
  );
}

function isActiveReservationConflict(error: unknown): boolean {
  const target = getUniqueConstraintTarget(error);

  return (
    target.includes("reservations_one_active_per_buyer_listing") ||
    (target.includes("listingid") && target.includes("buyerid")) ||
    (target.includes("listing_id") && target.includes("buyer_id"))
  );
}

// Notification failures must never undo an already committed reservation.
async function notifySafely(input: Parameters<typeof notify>[0]): Promise<void> {
  try {
    await notify(input);
  } catch (error) {
    console.error("[reservations] Notification failed:", error);
  }
}

async function createReservationAttempt(
  input: CreateReservationData,
  buyer: Buyer,
) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const listing = await tx.foodListing.findUnique({
      where: { id: input.listingId },
      include: {
        business: {
          select: {
            ownerId: true,
            status: true,
          },
        },
        category: {
          select: {
            b2bSuitability: true,
            isActive: true,
          },
        },
      },
    });

    if (!listing) {
      throw new ApiError(
        404,
        "LISTING_NOT_FOUND",
        "Food listing not found",
      );
    }

    if (buyer.role === "BUSINESS") {
      const buyerBusiness = await tx.business.findUnique({
        where: { ownerId: buyer.id },
        select: { status: true },
      });

      if (buyerBusiness?.status !== "ACTIVE") {
        throw new ApiError(
          403,
          "BUSINESS_NOT_APPROVED",
          "Your business must be approved before buying food",
        );
      }

      if (
        !listing.category.isActive ||
        listing.category.b2bSuitability !== "SUITABLE"
      ) {
        throw new ApiError(
          403,
          "B2B_CATEGORY_RESTRICTED",
          "This food category is not approved for business buyers",
        );
      }
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

    if (!listing.category.isActive) {
      throw new ApiError(
        409,
        "CATEGORY_INACTIVE",
        "This food category is no longer available",
      );
    }

    if (listing.status !== "ACTIVE" || listing.pickupEnd <= now) {
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

    // Prevent multiple active reservations by the same buyer.
    const existingReservation = await tx.reservation.findFirst({
      where: {
        listingId: listing.id,
        buyerId: buyer.id,
        status: "CONFIRMED",
      },
      select: {
        id: true,
      },
    });

    if (existingReservation) {
      throw new ApiError(
        409,
        "ACTIVE_RESERVATION_EXISTS",
        "You already have an active reservation for this listing",
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
        pickupEnd: { gt: now },
        quantityAvailable: { gte: input.quantity },
      },
      data: {
        quantityAvailable: {
          decrement: input.quantity,
        },
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

    const reservation = await tx.reservation.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        quantity: input.quantity,
        unitPrice,
        totalPrice,
        pickupCode: generatePickupCode(),
      },
    });

    return {
      reservation,
      businessOwnerId: listing.business.ownerId,
    };
  });
}

export async function createReservation(
  input: CreateReservationData,
  buyer: Buyer,
) {
  // Validate quantity at service level as well as API level.
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new ApiError(
      400,
      "INVALID_QUANTITY",
      "Quantity must be a positive whole number",
    );
  }

  let result:
    | Awaited<ReturnType<typeof createReservationAttempt>>
    | undefined;

  // Retry the entire transaction, not just the INSERT.
  // PostgreSQL transactions cannot safely continue after a unique violation.
  for (
    let attempt = 1;
    attempt <= MAX_PICKUP_CODE_ATTEMPTS;
    attempt++
  ) {
    try {
      result = await createReservationAttempt(input, buyer);
      break;
    } catch (error) {
      if (isPickupCodeCollision(error)) {
        if (attempt < MAX_PICKUP_CODE_ATTEMPTS) {
          continue;
        }

        throw new ApiError(
          409,
          "PICKUP_CODE_GENERATION_FAILED",
          "Unable to generate a unique pickup code. Please try again",
        );
      }

      // Handles concurrent duplicate requests caught by the
      // PostgreSQL partial unique index.
      if (isActiveReservationConflict(error)) {
        throw new ApiError(
          409,
          "ACTIVE_RESERVATION_EXISTS",
          "You already have an active reservation for this listing",
        );
      }

      throw error;
    }
  }

  if (!result) {
    throw new Error("Reservation creation failed unexpectedly");
  }

  const { reservation, businessOwnerId } = result;

  // Notify the buyer and the business owner after transaction commit.
  await Promise.all([
    notifySafely({
      userId: buyer.id,
      type: "RESERVATION_CONFIRMED",
      title: "Reservation confirmed",
      message: "Your food reservation has been confirmed.",
      listingId: reservation.listingId,
      reservationId: reservation.id,
    }),

    notifySafely({
      userId: businessOwnerId,
      type: "NEW_RESERVATION",
      title: "New reservation",
      message: "A buyer has reserved food from your listing.",
      listingId: reservation.listingId,
      reservationId: reservation.id,
    }),
  ]);

  return reservation;
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
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        listing: {
          include: {
            business: {
              select: {
                ownerId: true,
              },
            },
          },
        },
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

    const updatedReservation = await tx.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });

    return {
      reservation: updatedReservation,
      businessOwnerId: reservation.listing.business.ownerId,
    };
  });

  // Notify the business only after cancellation commits successfully.
  await notifySafely({
    userId: result.businessOwnerId,
    type: "RESERVATION_CANCELLED",
    title: "Reservation cancelled",
    message: "A buyer has cancelled a reservation for your listing.",
    listingId: result.reservation.listingId,
    reservationId: result.reservation.id,
  });

  return result.reservation;
}
