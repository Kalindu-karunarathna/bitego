import type { NotificationItem } from "@bitego/shared";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Helpers used by the GET /notifications, PATCH /notifications/:id/read and
// POST /notifications/mark-all-read route handlers.
// notify() lives in notify.ts (the team contract file); keep it separate.

const PAGE_SIZE = 20;

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
  listingId: true,
  reservationId: true,
} as const;

/** Converts a Prisma notification row to the shared NotificationItem shape. */
function toItem(row: {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  listingId: string | null;
  reservationId: string | null;
}): NotificationItem {
  return {
    id: row.id,
    type: row.type as NotificationItem["type"],
    title: row.title,
    message: row.message,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
    listingId: row.listingId,
    reservationId: row.reservationId,
  };
}

/**
 * Returns a paginated list of notifications for a user, newest first.
 * Also returns the total unread count (always, regardless of the unreadOnly filter)
 * and a hasMore flag.
 */
export async function listNotifications(
  userId: string,
  { page, unreadOnly }: { page: number; unreadOnly: boolean },
) {
  const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };

  const [rows, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1, // fetch one extra to cheaply detect hasMore
      select: NOTIFICATION_SELECT,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  const hasMore = rows.length > PAGE_SIZE;
  if (hasMore) rows.pop(); // remove the extra item before returning

  return { notifications: rows.map(toItem), unreadCount, hasMore };
}

/**
 * Marks a single notification as read.
 * Returns 404 if the notification does not exist or belongs to another user.
 */
export async function markOneRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true, isRead: true },
  });

  if (!notification || notification.userId !== userId) {
    throw new ApiError(404, "NOT_FOUND", "Notification not found");
  }

  // Already read — nothing to do, just return current state.
  if (notification.isRead) return { id: notification.id, isRead: true };

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
    select: { id: true, isRead: true },
  });
  return updated;
}

/**
 * Marks all of a user's unread notifications as read.
 * Returns the number of rows updated.
 */
export async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updatedCount: result.count };
}

