import type { NotificationTypeName } from "@bitego/shared";
import { prisma } from "@/lib/prisma";
import { sendPush } from "@/server/modules/notifications/push.service";

// CONTRACT. Anyone may call notify(); Sachira owns the body.
// Do NOT change the signature without telling the team.
export type NotifyInput = {
  userId: string;
  type: NotificationTypeName;
  title: string;
  message: string;
  listingId?: string;
  reservationId?: string;
};

/**
 * Saves an in-app notification for the user and dispatches an Expo push notification
 * to all active devices registered to that user.
 * Silently skips if the user has turned notifications off in their preferences.
 * Push delivery is fire-and-forget so delivery failures never disrupt business flows.
 */
export async function notify(input: NotifyInput): Promise<void> {
  // Respect the user's master notification toggle.
  // If no preference row exists yet, the default is enabled — so we proceed.
  const pref = await prisma.userPreference.findUnique({
    where: { userId: input.userId },
    select: { notificationsEnabled: true },
  });
  if (pref && !pref.notificationsEnabled) return;

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      listingId: input.listingId ?? null,
      reservationId: input.reservationId ?? null,
    },
  });

  // Fire-and-forget push dispatch: do NOT await, do NOT throw in caller
  void sendPush(input.userId, {
    title: input.title,
    body: input.message,
    data: {
      notificationId: notification.id,
      type: input.type,
      listingId: input.listingId ?? null,
      reservationId: input.reservationId ?? null,
    },
  }).catch((err) => {
    console.error(`[notify] Failed to dispatch push notification to user ${input.userId}:`, err);
  });
}
