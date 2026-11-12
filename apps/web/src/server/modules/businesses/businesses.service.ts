import type { PublicBusinessDto, SellerBusinessDto, UpdateBusinessInput } from "@bitego/shared";
import type { Business } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// A business's own profile and shop location, plus its public details. Owner: Kajanika.

async function ratingOf(businessId: string) {
  const { _avg, _count } = await prisma.review.aggregate({
    where: { businessId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return {
    averageRating: _avg.rating === null ? null : Math.round(_avg.rating * 10) / 10,
    reviewCount: _count._all,
  };
}

async function toSellerDto(b: Business): Promise<SellerBusinessDto> {
  const [rating, activeListings, rescued] = await Promise.all([
    ratingOf(b.id),
    prisma.foodListing.count({ where: { businessId: b.id, status: "ACTIVE", pickupEnd: { gt: new Date() } } }),
    prisma.reservation.aggregate({
      where: { status: "PICKED_UP", listing: { businessId: b.id } },
      _sum: { quantity: true },
    }),
  ]);
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    status: b.status,
    registrationNo: b.registrationNo,
    description: b.description,
    contactNo: b.contactNo,
    email: b.email,
    logoUrl: b.logoUrl,
    addressLine: b.addressLine,
    city: b.city,
    district: b.district,
    latitude: b.latitude,
    longitude: b.longitude,
    stats: { activeListings, itemsRescued: rescued._sum.quantity ?? 0, ...rating },
  };
}

export const getMyBusiness = (business: Business) => toSellerDto(business);

export async function updateMyBusiness(
  businessId: string,
  actorId: string,
  input: UpdateBusinessInput,
): Promise<SellerBusinessDto> {
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.business.update({
      where: { id: businessId },
      data: {
        ...input,
        description: input.description === undefined ? undefined : input.description || null,
        district: input.district === undefined ? undefined : input.district || null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "BUSINESS_PROFILE_UPDATED",
        entityType: "Business",
        entityId: businessId,
        metadata: { fields: Object.keys(input) },
      },
    });
    return row;
  });
  return toSellerDto(updated);
}

export async function getPublicBusiness(businessId: string): Promise<PublicBusinessDto> {
  const b = await prisma.business.findFirst({ where: { id: businessId, status: "ACTIVE" } });
  if (!b) throw new ApiError(404, "BUSINESS_NOT_FOUND", "Business not found");
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    description: b.description,
    contactNo: b.contactNo,
    logoUrl: b.logoUrl,
    addressLine: b.addressLine,
    city: b.city,
    district: b.district,
    latitude: b.latitude,
    longitude: b.longitude,
    ...(await ratingOf(b.id)),
  };
}
