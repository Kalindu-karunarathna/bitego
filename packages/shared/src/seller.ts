import { z } from "zod";
import {
  BUSINESS_TYPES,
  LISTING_AUDIENCES,
  LISTING_STATUSES,
  RESERVATION_STATUSES,
  type BusinessStatus,
  type BusinessType,
  type ListingAudience,
  type ListingStatus,
  type ReservationStatus,
} from "./constants";

// Types and zod schemas for the seller API, shared by the web backend and the mobile app. Owner: Kajanika.
// The API is described in docs/api/seller.md.

// Must match enum QuantityUnit in apps/web/prisma/schema.prisma.
export const QUANTITY_UNITS = ["PORTION", "PIECE", "PACK", "KG"] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export const SELLER_LISTING_FILTERS = [...LISTING_STATUSES, "ALL"] as const;
export type SellerListingFilter = (typeof SELLER_LISTING_FILTERS)[number];

export const SELLER_ORDER_FILTERS = [...RESERVATION_STATUSES, "ALL"] as const;
export type SellerOrderFilter = (typeof SELLER_ORDER_FILTERS)[number];

export const MAX_LISTING_IMAGES = 5;
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
export const LISTING_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ListingImageType = (typeof LISTING_IMAGE_TYPES)[number];

// ---------- Listings ----------

const MAX_PRICE = 9_999_999;
const money = (label: string) =>
  z.number({ error: `Enter the ${label}` }).min(0, `The ${label} cannot be negative`).max(MAX_PRICE, `The ${label} is too high`);
const dateTime = (label: string) => z.iso.datetime({ offset: true, error: `Choose the ${label}` });
const imageKey = z.string().regex(/^listings\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/, "Invalid photo");

const listingFields = {
  categoryId: z.uuid({ error: "Choose a category" }),
  title: z.string().trim().min(2, "Enter the food name").max(120, "The name is too long"),
  quantityTotal: z
    .number({ error: "Enter the quantity" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(10000, "Quantity is too high"),
  unit: z.enum(QUANTITY_UNITS, { error: "Choose a unit" }),
  originalPrice: money("original price"),
  price: money("price"),
  pickupStart: dateTime("pickup start time"),
  pickupEnd: dateTime("pickup end time"),
  audience: z.enum(LISTING_AUDIENCES, { error: "Choose who can buy this" }),
};

type ListingChecks = {
  originalPrice?: number;
  price?: number;
  pickupStart?: string;
  pickupEnd?: string;
};

function checkListing(value: ListingChecks, ctx: z.RefinementCtx) {
  if (value.price !== undefined && value.originalPrice !== undefined && value.price > value.originalPrice) {
    ctx.addIssue({ code: "custom", path: ["price"], message: "The price cannot be higher than the original price" });
  }
  if (value.pickupStart && value.pickupEnd && new Date(value.pickupEnd) <= new Date(value.pickupStart)) {
    ctx.addIssue({ code: "custom", path: ["pickupEnd"], message: "The pickup end must be after the start" });
  }
}

// POST /seller/listings. Upload the photos first, then send their keys here.
export const createListingSchema = z
  .object({
    ...listingFields,
    description: z.string().trim().max(1000, "The description is too long").optional(),
    pickupNote: z.string().trim().max(200, "The note is too long").optional(),
    imageKeys: z.array(imageKey).max(MAX_LISTING_IMAGES, `Add at most ${MAX_LISTING_IMAGES} photos`).optional(),
  })
  .superRefine(checkListing);
export type CreateListingInput = z.infer<typeof createListingSchema>;

// PATCH /seller/listings/:id. Send only what changes; null clears an optional text.
export const updateListingSchema = z
  .object({
    ...listingFields,
    description: z.string().trim().max(1000, "The description is too long").nullable(),
    pickupNote: z.string().trim().max(200, "The note is too long").nullable(),
  })
  .partial()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) ctx.addIssue({ code: "custom", path: ["form"], message: "Nothing to update" });
    checkListing(value, ctx);
  });
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

// POST /seller/listings/:id/cancel
export const cancelListingSchema = z.object({
  reason: z.string().trim().max(200, "The reason is too long").optional(),
});
export type CancelListingInput = z.infer<typeof cancelListingSchema>;

export type SellerListingImageDto = { id: string; imageUrl: string; isPrimary: boolean; displayOrder: number };

export type SellerListingDto = {
  id: string;
  title: string;
  description: string | null;
  category: { id: string; name: string };
  quantityTotal: number;
  quantityAvailable: number;
  unit: QuantityUnit;
  originalPrice: number;
  price: number;
  pickupStart: string;
  pickupEnd: string;
  pickupNote: string | null;
  audience: ListingAudience;
  // EXPIRED as soon as the pickup window has ended, even before the background job updates the row.
  status: ListingStatus;
  images: SellerListingImageDto[];
  reservations: { active: number; pickedUp: number };
  createdAt: string;
  updatedAt: string;
};

// ---------- Photo upload ----------

// POST /uploads/listing-images
export const listingImageUploadSchema = z.object({
  contentType: z.enum(LISTING_IMAGE_TYPES, { error: "Use a JPG, PNG or WebP photo" }),
});
export type ListingImageUploadInput = z.infer<typeof listingImageUploadSchema>;

// Send a multipart POST to uploadUrl: every entry of `fields`, then the file as "file".
export type ListingImageUploadDto = {
  key: string;
  imageUrl: string;
  uploadUrl: string;
  fields: Record<string, string>;
  maxBytes: number;
};

// POST /seller/listings/:id/images
export const addListingImageSchema = z.object({ key: imageKey });
export type AddListingImageInput = z.infer<typeof addListingImageSchema>;

// ---------- Business profile ----------

const phone = z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number");
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

// PATCH /seller/business. Same rules as registration (auth.ts). Send only what changes.
export const updateBusinessSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the business name").max(120),
    type: z.enum(BUSINESS_TYPES, { error: "Choose a business type" }),
    description: z.string().trim().max(500, "The description is too long").nullable(),
    contactNo: phone,
    email: email.nullable(),
    addressLine: z.string().trim().min(3, "Enter the shop address").max(200),
    city: z.string().trim().min(2, "Enter the city").max(80),
    district: z.string().trim().min(2, "Enter the district").max(80).nullable(),
    latitude: z.number({ error: "Set your shop location" }).min(-90).max(90),
    longitude: z.number({ error: "Set your shop location" }).min(-180).max(180),
  })
  .partial()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) ctx.addIssue({ code: "custom", path: ["form"], message: "Nothing to update" });
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      ctx.addIssue({ code: "custom", path: ["latitude"], message: "Send both latitude and longitude" });
    }
  });
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export type SellerBusinessDto = {
  id: string;
  name: string;
  type: BusinessType;
  status: BusinessStatus;
  registrationNo: string | null;
  description: string | null;
  contactNo: string;
  email: string | null;
  logoUrl: string | null;
  addressLine: string;
  city: string;
  district: string | null;
  latitude: number;
  longitude: number;
  stats: { activeListings: number; itemsRescued: number; averageRating: number | null; reviewCount: number };
};

// GET /businesses/:id (public)
export type PublicBusinessDto = Omit<SellerBusinessDto, "status" | "registrationNo" | "email" | "stats"> & {
  averageRating: number | null;
  reviewCount: number;
};

// ---------- Orders (reservations on my listings) ----------

// The buyer's pickup code: exactly 6 letters or digits. Lowercase input is accepted.
export const pickupCodeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, "Enter the 6-character pickup code"),
});
export type PickupCodeInput = z.infer<typeof pickupCodeSchema>;

// The pickup code is deliberately not included: the seller must get it from the buyer.
export type SellerOrderDto = {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: ReservationStatus;
  pickedUpAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  // phone is shared so the seller can call about the pickup; null when the buyer gave none.
  buyer: { fullName: string; isBusiness: boolean; phone: string | null };
  listing: {
    id: string;
    title: string;
    unit: QuantityUnit;
    pickupStart: string;
    pickupEnd: string;
    imageUrl: string | null;
  };
};

// ---------- Activity (GET /seller/activity) ----------

export const ACTIVITY_PERIODS = ["TODAY", "WEEK", "MONTH"] as const;
export type ActivityPeriod = (typeof ACTIVITY_PERIODS)[number];

// Days are in Sri Lanka time. "previous..." values cover the same length of time just before the period.
export type SellerActivityDto = {
  period: ActivityPeriod;
  listingsCreated: number;
  previousListingsCreated: number;
  portionsReserved: number; // reserved in the period, cancelled ones excluded
  portionsCollected: number; // picked up in the period
  previousPortionsCollected: number;
  portionsAwaiting: number; // reserved in the period and still waiting for pickup
  portionsCancelled: number;
  revenue: number; // total paid at pickup in the period
  previousRevenue: number;
  completionRate: number | null; // % of portions reserved in the period that were collected
  last7Days: { date: string; collected: number }[];
  revenueByListing: { title: string; portions: number; revenue: number }[];
};
