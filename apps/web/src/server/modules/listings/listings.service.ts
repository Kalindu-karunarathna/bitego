import {
  MAX_LISTING_IMAGES,
  type CancelListingInput,
  type CreateListingInput,
  type ListingStatus,
  type SellerListingDto,
  type SellerListingFilter,
  type UpdateListingInput,
} from "@bitego/shared";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { onListingCreated } from "@/server/modules/matching/matching";
import { notify } from "@/server/modules/notifications/notify";
import { deleteListingImageFile, listingImageUrl } from "@/server/modules/uploads/uploads.service";

// A business's own food listings: create, edit, cancel, list and photos. Owner: Kajanika.

const include = {
  category: { select: { id: true, name: true } },
  images: { orderBy: { displayOrder: "asc" as const } },
  reservations: { select: { status: true } },
} satisfies Prisma.FoodListingInclude;

type Row = Prisma.FoodListingGetPayload<{ include: typeof include }>;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function effectiveStatus(status: ListingStatus, pickupEnd: Date): ListingStatus {
  const windowOpenStatus = status === "ACTIVE" || status === "SOLD_OUT";
  return windowOpenStatus && pickupEnd.getTime() <= Date.now() ? "EXPIRED" : status;
}

function toDto(l: Row): SellerListingDto {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    category: l.category,
    quantityTotal: l.quantityTotal,
    quantityAvailable: l.quantityAvailable,
    unit: l.unit,
    originalPrice: Number(l.originalPrice),
    price: Number(l.price),
    pickupStart: l.pickupStart.toISOString(),
    pickupEnd: l.pickupEnd.toISOString(),
    pickupNote: l.pickupNote,
    audience: l.audience,
    status: effectiveStatus(l.status, l.pickupEnd),
    images: l.images.map((i) => ({
      id: i.id,
      imageUrl: i.imageUrl,
      isPrimary: i.isPrimary,
      displayOrder: i.displayOrder,
    })),
    reservations: {
      active: l.reservations.filter((r) => r.status === "CONFIRMED").length,
      pickedUp: l.reservations.filter((r) => r.status === "PICKED_UP").length,
    },
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

async function loadOwned(businessId: string, listingId: string): Promise<Row> {
  const listing = await prisma.foodListing.findFirst({ where: { id: listingId, businessId }, include });
  if (!listing) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing not found");
  return listing;
}

function assertEditable(listing: Row) {
  const status = effectiveStatus(listing.status, listing.pickupEnd);
  if (status !== "ACTIVE" && status !== "SOLD_OUT") {
    throw new ApiError(409, "LISTING_NOT_EDITABLE", "This listing has ended and can no longer be changed");
  }
}

// A listing only for businesses must use a category that is safe for B2B (proposal section 6.6).
async function assertCategoryAllowed(categoryId: string, audience: string, mustBeActive: boolean) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || (mustBeActive && !category.isActive)) {
    throw new ApiError(400, "CATEGORY_NOT_AVAILABLE", "This category is not available");
  }
  if (audience === "BUSINESSES_ONLY" && category.b2bSuitability !== "SUITABLE") {
    throw new ApiError(
      400,
      "CATEGORY_NOT_B2B_SUITABLE",
      `${category.name} cannot be sold only to businesses. Choose another category or audience.`,
    );
  }
}

export async function listMyListings(businessId: string, filter: SellerListingFilter): Promise<SellerListingDto[]> {
  const rows = await prisma.foodListing.findMany({
    where: { businessId },
    include,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const listings = rows.map(toDto);
  return filter === "ALL" ? listings : listings.filter((l) => l.status === filter);
}

export async function getMyListing(businessId: string, listingId: string): Promise<SellerListingDto> {
  return toDto(await loadOwned(businessId, listingId));
}

export async function createListing(
  businessId: string,
  actorId: string,
  input: CreateListingInput,
): Promise<SellerListingDto> {
  if (new Date(input.pickupEnd).getTime() <= Date.now()) {
    throw new ApiError(400, "PICKUP_ALREADY_ENDED", "The pickup end time has already passed");
  }
  await assertCategoryAllowed(input.categoryId, input.audience, true);
  const imageUrls = (input.imageKeys ?? []).map((key) => listingImageUrl(businessId, key));

  const listing = await prisma.$transaction(async (tx) => {
    const created = await tx.foodListing.create({
      data: {
        businessId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description || null,
        quantityTotal: input.quantityTotal,
        quantityAvailable: input.quantityTotal,
        unit: input.unit,
        originalPrice: roundMoney(input.originalPrice),
        price: roundMoney(input.price),
        pickupStart: new Date(input.pickupStart),
        pickupEnd: new Date(input.pickupEnd),
        pickupNote: input.pickupNote || null,
        audience: input.audience,
        images: {
          create: imageUrls.map((imageUrl, displayOrder) => ({ imageUrl, displayOrder, isPrimary: displayOrder === 0 })),
        },
      },
      include,
    });
    await tx.auditLog.create({
      data: { actorId, action: "LISTING_CREATED", entityType: "Listing", entityId: created.id },
    });
    return created;
  });

  // Matching failing must never undo the listing the business just posted.
  try {
    await onListingCreated(listing.id);
  } catch (err) {
    console.error("onListingCreated failed:", err);
  }

  return toDto(listing);
}

export async function updateListing(
  businessId: string,
  actorId: string,
  listingId: string,
  input: UpdateListingInput,
): Promise<SellerListingDto> {
  const current = await loadOwned(businessId, listingId);
  assertEditable(current);

  const originalPrice = input.originalPrice ?? Number(current.originalPrice);
  const price = input.price ?? Number(current.price);
  if (price > originalPrice) {
    throw new ApiError(400, "INVALID_PRICE", "The price cannot be higher than the original price");
  }

  const pickupStart = input.pickupStart ? new Date(input.pickupStart) : current.pickupStart;
  const pickupEnd = input.pickupEnd ? new Date(input.pickupEnd) : current.pickupEnd;
  if (pickupEnd <= pickupStart) {
    throw new ApiError(400, "INVALID_PICKUP_WINDOW", "The pickup end must be after the start");
  }
  if (input.pickupEnd && pickupEnd.getTime() <= Date.now()) {
    throw new ApiError(400, "PICKUP_ALREADY_ENDED", "The pickup end time has already passed");
  }
  const hasActiveReservations = current.reservations.some((r) => r.status === "CONFIRMED");
  if (hasActiveReservations && (pickupStart > current.pickupStart || pickupEnd < current.pickupEnd)) {
    throw new ApiError(
      409,
      "PICKUP_WINDOW_LOCKED",
      "Buyers have already reserved this food, so the pickup time can only be extended",
    );
  }

  const categoryId = input.categoryId ?? current.categoryId;
  const audience = input.audience ?? current.audience;
  if (categoryId !== current.categoryId || audience !== current.audience) {
    await assertCategoryAllowed(categoryId, audience, categoryId !== current.categoryId);
  }

  const reserved = current.quantityTotal - current.quantityAvailable;
  const quantityTotal = input.quantityTotal ?? current.quantityTotal;
  if (quantityTotal < reserved) {
    throw new ApiError(409, "QUANTITY_BELOW_RESERVED", `${reserved} are already reserved, so the quantity cannot be lower`, {
      reserved,
    });
  }
  const quantityAvailable = quantityTotal - reserved;

  const updated = await prisma.$transaction(async (tx) => {
    // The quantity check inside the update makes this safe if a buyer reserves at the same moment.
    const changed = await tx.foodListing.updateMany({
      where: {
        id: listingId,
        businessId,
        status: current.status,
        quantityTotal: current.quantityTotal,
        quantityAvailable: current.quantityAvailable,
      },
      data: {
        categoryId,
        audience,
        title: input.title,
        description: input.description === undefined ? undefined : input.description || null,
        pickupNote: input.pickupNote === undefined ? undefined : input.pickupNote || null,
        unit: input.unit,
        originalPrice: roundMoney(originalPrice),
        price: roundMoney(price),
        pickupStart,
        pickupEnd,
        quantityTotal,
        quantityAvailable,
        status: quantityAvailable > 0 ? "ACTIVE" : "SOLD_OUT",
      },
    });
    if (changed.count === 0) {
      throw new ApiError(409, "LISTING_CHANGED", "This listing just changed. Please try again.");
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: "LISTING_UPDATED",
        entityType: "Listing",
        entityId: listingId,
        metadata: { fields: Object.keys(input) },
      },
    });
    return tx.foodListing.findUniqueOrThrow({ where: { id: listingId }, include });
  });

  return toDto(updated);
}

export async function cancelListing(
  businessId: string,
  actorId: string,
  listingId: string,
  input: CancelListingInput,
): Promise<SellerListingDto> {
  const current = await loadOwned(businessId, listingId);
  assertEditable(current);
  const reason = input.reason || "Cancelled by the seller";

  const { updated, buyers } = await prisma.$transaction(async (tx) => {
    const changed = await tx.foodListing.updateMany({
      where: { id: listingId, businessId, status: { in: ["ACTIVE", "SOLD_OUT"] } },
      data: { status: "CANCELLED" },
    });
    if (changed.count === 0) {
      throw new ApiError(409, "LISTING_NOT_EDITABLE", "This listing has ended and can no longer be changed");
    }

    // Read after locking the listing row, so nobody can reserve between this read and the update below.
    const active = await tx.reservation.findMany({
      where: { listingId, status: "CONFIRMED" },
      select: { id: true, buyerId: true, quantity: true },
    });
    if (active.length > 0) {
      await tx.reservation.updateMany({
        where: { id: { in: active.map((r) => r.id) } },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
      });
      await tx.foodListing.update({
        where: { id: listingId },
        data: { quantityAvailable: { increment: active.reduce((sum, r) => sum + r.quantity, 0) } },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: "LISTING_CANCELLED",
        entityType: "Listing",
        entityId: listingId,
        metadata: { reason, reservationsCancelled: active.length },
      },
    });
    return { updated: await tx.foodListing.findUniqueOrThrow({ where: { id: listingId }, include }), buyers: active };
  });

  // A failed notification must never undo the cancellation.
  await Promise.all(
    buyers.map((r) =>
      notify({
        userId: r.buyerId,
        type: "RESERVATION_CANCELLED",
        title: "Your reservation was cancelled",
        message: `The seller cancelled ${updated.title}. ${reason === "Cancelled by the seller" ? "" : reason}`.trim(),
        listingId,
        reservationId: r.id,
      }).catch((err) => console.error("notify failed after listing cancel:", err)),
    ),
  );

  return toDto(updated);
}

export async function addListingImage(businessId: string, listingId: string, key: string): Promise<SellerListingDto> {
  const current = await loadOwned(businessId, listingId);
  assertEditable(current);
  if (current.images.length >= MAX_LISTING_IMAGES) {
    throw new ApiError(409, "TOO_MANY_IMAGES", `A listing can have at most ${MAX_LISTING_IMAGES} photos`);
  }
  const imageUrl = listingImageUrl(businessId, key);
  const lastOrder = current.images.at(-1)?.displayOrder ?? -1;
  await prisma.listingImage.create({
    data: { listingId, imageUrl, displayOrder: lastOrder + 1, isPrimary: current.images.length === 0 },
  });
  return getMyListing(businessId, listingId);
}

export async function removeListingImage(
  businessId: string,
  listingId: string,
  imageId: string,
): Promise<SellerListingDto> {
  const current = await loadOwned(businessId, listingId);
  assertEditable(current);
  const image = current.images.find((i) => i.id === imageId);
  if (!image) throw new ApiError(404, "IMAGE_NOT_FOUND", "Photo not found");

  await prisma.$transaction(async (tx) => {
    await tx.listingImage.delete({ where: { id: imageId } });
    const next = current.images.find((i) => i.id !== imageId);
    if (image.isPrimary && next) {
      await tx.listingImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  });
  await deleteListingImageFile(image.imageUrl);
  return getMyListing(businessId, listingId);
}
