// Types and zod schemas for the "notifications" API, shared by the web backend and the mobile app. Owner: Sachira.
// Add them here, not in index.ts (index.ts already exports this file).

// Must match enum NotificationType in apps/web/prisma/schema.prisma.
export const NOTIFICATION_TYPES = [
  "NEW_NEARBY_LISTING",
  "NEW_RESERVATION",
  "RESERVATION_CONFIRMED",
  "RESERVATION_CANCELLED",
  "LISTING_NEARING_EXPIRY",
  "LISTING_SOLD_OUT",
  "PICKUP_REMINDER",
  "BUSINESS_APPROVED",
  "BUSINESS_REJECTED",
] as const;
export type NotificationTypeName = (typeof NOTIFICATION_TYPES)[number];
