import type {
  NotificationsListResponse,
  PickupRouteInput,
  PickupRouteResponse,
  RegisterPushTokenInput,
  RegisterPushTokenResponse,
  RemovePushTokenInput,
  RemovePushTokenResponse,
} from "@bitego/shared";
import { apiFetch } from "@/api/client";

// Owner: Sachira. Talks to the backend notifications API (/api/v1/notifications).

export type FetchNotificationsParams = {
  page?: number;
  unread?: boolean;
};

/**
 * Fetches notifications for the authenticated user, newest first.
 * Supports pagination and optional unread-only filtering.
 */
export function fetchNotifications(params?: FetchNotificationsParams): Promise<NotificationsListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.unread) query.set("unread", "true");

  const qs = query.toString();
  return apiFetch<NotificationsListResponse>(`/notifications${qs ? `?${qs}` : ""}`);
}

/**
 * Marks a single notification as read by ID.
 */
export function markNotificationRead(id: string): Promise<{ id: string; isRead: boolean }> {
  return apiFetch<{ id: string; isRead: boolean }>(`/notifications/${id}/read`, {
    method: "PATCH",
  });
}

/**
 * Marks all notifications for the authenticated user as read.
 */
export function markAllNotificationsRead(): Promise<{ updatedCount: number }> {
  return apiFetch<{ updatedCount: number }>("/notifications/mark-all-read", {
    method: "POST",
  });
}

/**
 * Registers an Expo push token with the backend.
 */
export function registerPushToken(input: RegisterPushTokenInput): Promise<RegisterPushTokenResponse> {
  return apiFetch<RegisterPushTokenResponse>("/notifications/push-token", {
    method: "POST",
    body: input,
  });
}

/**
 * Removes an Expo push token from the backend upon logout.
 */
export function removePushToken(input: RemovePushTokenInput): Promise<RemovePushTokenResponse> {
  return apiFetch<RemovePushTokenResponse>("/notifications/push-token", {
    method: "DELETE",
    body: input,
  });
}

/** Route to the authenticated buyer's reservation; server selects the shop. */
export function fetchPickupRoute(input: PickupRouteInput): Promise<PickupRouteResponse> {
  return apiFetch<PickupRouteResponse>("/notifications/pickup-route", {
    method: "POST", body: input,
  });
}
