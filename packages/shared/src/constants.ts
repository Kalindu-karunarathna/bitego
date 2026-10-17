export const ROLES = ["CUSTOMER", "PROVIDER", "BUSINESS_BUYER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const LISTING_STATUSES = ["ACTIVE", "RESERVED", "SOLD_OUT", "EXPIRED", "CANCELLED"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "PICKED_UP", "CANCELLED", "EXPIRED"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
