
import { z } from "zod";
import {
  LISTING_AUDIENCES,
  LISTING_STATUSES,
  BUSINESS_TYPES,
} from "./constants";

// Types and validation schemas for the Buyer Discovery API.
// Owner: Nistha.

// ---------- Discovery filters ----------

// GET /api/v1/listings
// Must match the QuantityUnit enum in Prisma.
const QUANTITY_UNITS = [
  "PORTION",
  "PIECE",
  "PACK",
  "KG",
] as const;
export const discoveryFiltersSchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    categoryId: z.string().uuid().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),

    // The backend must enforce audience access using the authenticated user's role.
    audience: z.enum(LISTING_AUDIENCES).optional(),

    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(100).optional(),

    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine(
    (filters) =>
      filters.minPrice === undefined ||
      filters.maxPrice === undefined ||
      filters.minPrice <= filters.maxPrice,
    {
      message: "Minimum price cannot exceed maximum price",
      path: ["maxPrice"],
    },
  )
  .refine(
    (filters) =>
      (filters.latitude === undefined) ===
      (filters.longitude === undefined),
    {
      message: "Latitude and longitude must be provided together",
      path: ["longitude"],
    },
  )
  .refine(
    (filters) =>
      filters.radiusKm === undefined ||
      (filters.latitude !== undefined &&
        filters.longitude !== undefined),
    {
      message: "Coordinates are required when radius is provided",
      path: ["radiusKm"],
    },
  );

export type DiscoveryFilters = z.infer<typeof discoveryFiltersSchema>;

// ---------- Listing information ----------

// GET /api/v1/listings
// GET /api/v1/listings/:id

export const listingImageSchema = z.object({
  id: z.string().uuid(),
  imageUrl: z.string().url(),
  isPrimary: z.boolean(),
  displayOrder: z.number().int(),
});

export type ListingImageDto = z.infer<typeof listingImageSchema>;

export const listingCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  iconUrl: z.string().url().nullable(),
});

export type ListingCategoryDto = z.infer<typeof listingCategorySchema>;

export const listingBusinessSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(BUSINESS_TYPES),
  addressLine: z.string(),
  city: z.string(),
  district: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  distanceKm: z.number().nonnegative().optional(),
});

export type ListingBusinessDto = z.infer<typeof listingBusinessSchema>;

// Shared listing information returned to buyers.
export const listingDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),

  quantityTotal: z.number().int().nonnegative(),
  quantityAvailable: z.number().int().nonnegative(),
  unit: z.enum(QUANTITY_UNITS),

  // Prisma Decimal values must be converted to numbers by the API.
  originalPrice: z.number().nonnegative(),
  price: z.number().nonnegative(),

  // Dates must be converted to strings by the API.
  pickupStart: z.string(),
  pickupEnd: z.string(),
  pickupNote: z.string().nullable(),

  audience: z.enum(LISTING_AUDIENCES),
  status: z.enum(LISTING_STATUSES),

  createdAt: z.string(),

  category: listingCategorySchema,
  business: listingBusinessSchema,
  images: z.array(listingImageSchema),
});

export type ListingDto = z.infer<typeof listingDtoSchema>;

// ---------- Discovery responses ----------

// GET /api/v1/listings
export const discoveryResponseSchema = z.object({
  items: z.array(listingDtoSchema),
  nextCursor: z.string().uuid().nullable(),
});

export type DiscoveryResponse = z.infer<typeof discoveryResponseSchema>;

// GET /api/v1/listings/:id
export const listingDetailResponseSchema = listingDtoSchema;

export type ListingDetailResponse = z.infer<
  typeof listingDetailResponseSchema
>;
