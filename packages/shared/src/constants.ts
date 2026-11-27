// Values shared by the mobile app and the web app.
// They must match the enums in apps/web/prisma/schema.prisma.

export const ROLES = ["CUSTOMER", "BUSINESS", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const BUSINESS_TYPES = [
  "RESTAURANT",
  "CAFE",
  "BAKERY",
  "SUPERMARKET",
  "CANTEEN",
  "HOTEL",
  "SHOP",
  "OTHER",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_STATUSES = ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const LISTING_AUDIENCES = ["CUSTOMERS_ONLY", "BUSINESSES_ONLY", "EVERYONE"] as const;
export type ListingAudience = (typeof LISTING_AUDIENCES)[number];

export const LISTING_STATUSES = ["ACTIVE", "SOLD_OUT", "COMPLETED", "EXPIRED", "CANCELLED"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const RESERVATION_STATUSES = ["CONFIRMED", "PICKED_UP", "CANCELLED", "EXPIRED"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
