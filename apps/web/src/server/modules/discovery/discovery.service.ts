import type {
  DiscoveryFilters,
  DiscoveryResponse,
  ListingDto,
} from "@bitego/shared";

import type { Prisma, Role } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type ListingAudienceValue =
  | "EVERYONE"
  | "CUSTOMERS_ONLY"
  | "BUSINESSES_ONLY";

const listingInclude = {
  category: {
    select: {
      id: true,
      name: true,
      description: true,
      iconUrl: true,
    },
  },
  business: {
    select: {
      id: true,
      name: true,
      type: true,
      addressLine: true,
      city: true,
      district: true,
      latitude: true,
      longitude: true,
    },
  },
  images: {
    orderBy: {
      displayOrder: "asc",
    },
    select: {
      id: true,
      imageUrl: true,
      isPrimary: true,
      displayOrder: true,
    },
  },
} satisfies Prisma.FoodListingInclude;

type ListingWithRelations = Prisma.FoodListingGetPayload<{
  include: typeof listingInclude;
}>;

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function toListingDto(
  listing: ListingWithRelations,
  distanceKm?: number,
): ListingDto {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    quantityTotal: listing.quantityTotal,
    quantityAvailable: listing.quantityAvailable,
    unit: listing.unit,
    originalPrice: listing.originalPrice.toNumber(),
    price: listing.price.toNumber(),
    pickupStart: listing.pickupStart.toISOString(),
    pickupEnd: listing.pickupEnd.toISOString(),
    pickupNote: listing.pickupNote,
    audience: listing.audience,
    status: listing.status,
    createdAt: listing.createdAt.toISOString(),

    category: listing.category,

    business: {
      ...listing.business,
      ...(distanceKm !== undefined ? { distanceKm } : {}),
    },

    images: listing.images,
  };
}

function getAllowedAudiences(role: Role): ListingAudienceValue[] {
  return role === "CUSTOMER"
    ? ["EVERYONE", "CUSTOMERS_ONLY"]
    : ["EVERYONE", "BUSINESSES_ONLY"];
}

export async function discoverListings(
  filters: DiscoveryFilters,
  userId: string,
  role: Role,
): Promise<DiscoveryResponse> {
  const now = new Date();

  const allowedAudiences = getAllowedAudiences(role);

  const audienceFilter: ListingAudienceValue[] = filters.audience
    ? allowedAudiences.filter(
        (value) => value === filters.audience,
      )
    : allowedAudiences;

  const where = {
    status: "ACTIVE" as const,

    quantityAvailable: {
      gt: 0,
    },

    pickupEnd: {
      gt: now,
    },

    audience: {
      in: audienceFilter,
    },

    business: {
      is: {
        status: "ACTIVE" as const,
        ownerId: {
          not: userId,
        },
      },
    },

    category: {
      is: {
        isActive: true,
      },
    },

    ...(filters.categoryId
      ? {
          categoryId: filters.categoryId,
        }
      : {}),

    ...(filters.minPrice !== undefined ||
    filters.maxPrice !== undefined
      ? {
          price: {
            ...(filters.minPrice !== undefined
              ? { gte: filters.minPrice }
              : {}),
            ...(filters.maxPrice !== undefined
              ? { lte: filters.maxPrice }
              : {}),
          },
        }
      : {}),

    ...(filters.search
      ? {
          OR: [
            {
              title: {
                contains: filters.search,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: filters.search,
                mode: "insensitive" as const,
              },
            },
            {
              business: {
                is: {
                  name: {
                    contains: filters.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.FoodListingWhereInput;

  const radiusSearch = filters.radiusKm !== undefined;

  // When radius filtering is requested, load matching listings
  // before applying pagination.
  const listings: ListingWithRelations[] =
    await prisma.foodListing.findMany({
      where,
      include: listingInclude,

      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],

      ...(!radiusSearch
        ? {
            ...(filters.cursor
              ? {
                  cursor: {
                    id: filters.cursor,
                  },
                  skip: 1,
                }
              : {}),

            take: filters.limit + 1,
          }
        : {}),
    });

  let items = listings.map((listing) => {
    const distance =
      filters.latitude !== undefined &&
      filters.longitude !== undefined
        ? calculateDistance(
            filters.latitude,
            filters.longitude,
            listing.business.latitude,
            listing.business.longitude,
          )
        : undefined;

    return toListingDto(listing, distance);
  });

  // Radius filtering and pagination.
  if (radiusSearch) {
    if (
      filters.latitude === undefined ||
      filters.longitude === undefined
    ) {
      throw new ApiError(
        400,
        "LOCATION_REQUIRED",
        "Latitude and longitude are required for radius filtering",
      );
    }

    items = items.filter(
      (item) =>
        item.business.distanceKm !== undefined &&
        item.business.distanceKm <= filters.radiusKm!,
    );

    if (filters.cursor) {
      const cursorIndex = items.findIndex(
        (item) => item.id === filters.cursor,
      );

      if (cursorIndex === -1) {
        throw new ApiError(
          400,
          "INVALID_CURSOR",
          "The pagination cursor is invalid",
        );
      }

      items = items.slice(cursorIndex + 1);
    }

    const hasMore = items.length > filters.limit;
    const pageItems = items.slice(0, filters.limit);

    return {
      items: pageItems,
      nextCursor: hasMore
        ? pageItems[pageItems.length - 1].id
        : null,
    };
  }

  // Normal cursor-based pagination.
  const hasMore = items.length > filters.limit;
  const pageItems = items.slice(0, filters.limit);

  return {
    items: pageItems,
    nextCursor: hasMore
      ? pageItems[pageItems.length - 1].id
      : null,
  };
}

export async function getListingDetail(
  listingId: string,
  userId: string,
  role: Role,
): Promise<ListingDto> {
  const allowedAudiences = getAllowedAudiences(role);

  const listing = await prisma.foodListing.findFirst({
    where: {
      id: listingId,

      status: "ACTIVE",

      quantityAvailable: {
        gt: 0,
      },

      pickupEnd: {
        gt: new Date(),
      },

      audience: {
        in: allowedAudiences,
      },

      business: {
        is: {
          status: "ACTIVE",
          ownerId: {
            not: userId,
          },
        },
      },

      category: {
        is: {
          isActive: true,
        },
      },
    },

    include: listingInclude,
  });

  if (!listing) {
    throw new ApiError(
      404,
      "LISTING_NOT_FOUND",
      "Food listing not found or unavailable",
    );
  }

  return toListingDto(listing);
}