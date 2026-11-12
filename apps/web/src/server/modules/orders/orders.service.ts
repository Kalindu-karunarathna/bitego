import type { SellerOrderDto, SellerOrderFilter } from "@bitego/shared";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Reservations on a business's own listings, and the pickup-code check. Owner: Kajanika.

const select = {
  id: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  status: true,
  pickedUpAt: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
  buyer: { select: { fullName: true, role: true, phone: true } },
  listing: {
    select: {
      id: true,
      title: true,
      unit: true,
      pickupStart: true,
      pickupEnd: true,
      images: { where: { isPrimary: true }, select: { imageUrl: true }, take: 1 },
    },
  },
} satisfies Prisma.ReservationSelect;

type Row = Prisma.ReservationGetPayload<{ select: typeof select }>;

function toDto(r: Row): SellerOrderDto {
  return {
    id: r.id,
    quantity: r.quantity,
    unitPrice: Number(r.unitPrice),
    totalPrice: Number(r.totalPrice),
    status: r.status,
    pickedUpAt: r.pickedUpAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    cancelReason: r.cancelReason,
    createdAt: r.createdAt.toISOString(),
    buyer: { fullName: r.buyer.fullName, isBusiness: r.buyer.role === "BUSINESS", phone: r.buyer.phone },
    listing: {
      id: r.listing.id,
      title: r.listing.title,
      unit: r.listing.unit,
      pickupStart: r.listing.pickupStart.toISOString(),
      pickupEnd: r.listing.pickupEnd.toISOString(),
      imageUrl: r.listing.images[0]?.imageUrl ?? null,
    },
  };
}

export async function listOrders(
  businessId: string,
  filter: SellerOrderFilter,
  listingId?: string,
): Promise<SellerOrderDto[]> {
  const rows = await prisma.reservation.findMany({
    where: {
      listing: { businessId },
      ...(listingId ? { listingId } : {}),
      ...(filter === "ALL" ? {} : { status: filter }),
    },
    select,
    orderBy: filter === "CONFIRMED" ? { listing: { pickupEnd: "asc" } } : { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toDto);
}

export async function getOrder(businessId: string, orderId: string): Promise<SellerOrderDto> {
  const row = await prisma.reservation.findFirst({ where: { id: orderId, listing: { businessId } }, select });
  if (!row) throw new ApiError(404, "ORDER_NOT_FOUND", "Reservation not found");
  return toDto(row);
}

// The same "wrong code" answer for unknown codes and for other shops' codes.
async function findActiveByCode(businessId: string, code: string) {
  const row = await prisma.reservation.findFirst({ where: { pickupCode: code, listing: { businessId } }, select });
  if (!row) throw new ApiError(404, "INVALID_CODE", "This pickup code is not valid for your shop");
  if (row.status === "PICKED_UP") throw new ApiError(409, "ALREADY_PICKED_UP", "This order was already picked up");
  if (row.status !== "CONFIRMED") {
    throw new ApiError(409, "RESERVATION_NOT_ACTIVE", "This reservation was cancelled or has expired");
  }
  return row;
}

export async function verifyPickupCode(businessId: string, code: string): Promise<SellerOrderDto> {
  return toDto(await findActiveByCode(businessId, code));
}

export async function confirmPickup(businessId: string, actorId: string, code: string): Promise<SellerOrderDto> {
  const found = await findActiveByCode(businessId, code);

  const updated = await prisma.$transaction(async (tx) => {
    // The status check inside the update stops the same code being used twice at the same moment.
    const changed = await tx.reservation.updateMany({
      where: { id: found.id, status: "CONFIRMED" },
      data: { status: "PICKED_UP", pickedUpAt: new Date() },
    });
    if (changed.count === 0) throw new ApiError(409, "ALREADY_PICKED_UP", "This order was already picked up");

    // A sold-out listing is finished once nobody is left to collect.
    const waiting = await tx.reservation.count({ where: { listingId: found.listing.id, status: "CONFIRMED" } });
    if (waiting === 0) {
      await tx.foodListing.updateMany({
        where: { id: found.listing.id, status: "SOLD_OUT", quantityAvailable: 0 },
        data: { status: "COMPLETED" },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: "RESERVATION_PICKED_UP",
        entityType: "Reservation",
        entityId: found.id,
        metadata: { listingId: found.listing.id, quantity: found.quantity },
      },
    });
    return tx.reservation.findUniqueOrThrow({ where: { id: found.id }, select });
  });

  return toDto(updated);
}
