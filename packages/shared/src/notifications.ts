import { z } from "zod";

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

// ─────────────────────────── Response shapes ───────────────────────────

/** A single in-app notification as returned by GET /notifications. */
export type NotificationItem = {
  id: string;
  type: NotificationTypeName;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string; // ISO 8601
  listingId: string | null;
  reservationId: string | null;
};

/** GET /api/v1/notifications */
export type NotificationsListResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
  hasMore: boolean;
};

// ─────────────────────────── Request schemas ───────────────────────────

/** PATCH /api/v1/notifications/:id/read — no body needed (id is in the URL). */

/** POST /api/v1/notifications/mark-all-read — no body needed. */

/** POST /api/v1/notifications/push-token */
export const DEVICE_PLATFORMS = ["ANDROID", "IOS"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const registerPushTokenSchema = z.object({
  /** Expo push token, e.g. "ExponentPushToken[xxxx]" */
  token: z.string().trim().min(1, "Token is required"),
  platform: z.enum(DEVICE_PLATFORMS, { error: "Platform must be ANDROID or IOS" }),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

/** DELETE /api/v1/notifications/push-token — deregister on logout */
export const removePushTokenSchema = z.object({
  token: z.string().trim().min(1, "Token is required"),
});
export type RemovePushTokenInput = z.infer<typeof removePushTokenSchema>;

/** GET /api/v1/notifications query params */
export const listNotificationsQuerySchema = z.object({
  /** Return only unread notifications when "true". */
  unread: z.enum(["true", "false"]).optional(),
  /** Page number, 1-based. */
  page: z.coerce.number().int().min(1).default(1),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
