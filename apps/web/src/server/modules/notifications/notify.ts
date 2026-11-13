import type { NotificationTypeName } from "@bitego/shared";
import { prisma } from "@/lib/prisma";
import { notificationIdentity, type NotificationIdentity } from "./notification-identity";
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
 * Matching and reminder events are deduplicated across calls and server instances.
 * Push delivery is fire-and-forget so delivery failures never disrupt business flows.
 */
export async function notify(input: NotifyInput): Promise<void> {
  await saveAndDispatch(input, notificationIdentity(input));
}

export type NotifyOnceInput = Omit<NotifyInput, "type"> & (
  | { type: "NEW_NEARBY_LISTING" | "LISTING_NEARING_EXPIRY"; listingId: string }
  | { type: "PICKUP_REMINDER"; reservationId: string }
);

/** True only when this call creates a row; useful for accurate background-job counts. */
export async function notifyOnce(input: NotifyOnceInput): Promise<boolean> {
  const identity = notificationIdentity(input);
  if (!identity) throw new Error("This notification type does not support notifyOnce");
  return saveAndDispatch(input, identity);
}

async function saveAndDispatch(input: NotifyInput, identity: NotificationIdentity | null): Promise<boolean> {
  // Respect the user's master notification toggle.
  // If no preference row exists yet, the default is enabled — so we proceed.
  const pref = await prisma.userPreference.findUnique({
    where: { userId: input.userId },
    select: { notificationsEnabled: true },
  });
  if (pref && !pref.notificationsEnabled) return false;

  // Recognize pre-existing notifications with random UUIDs too, including read rows.
  // This lookup alone is NOT the concurrency guard; the deterministic primary key is.
  if (identity && await prisma.notification.findFirst({ where: identity.where, select: { id: true } })) {
    return false;
  }

  let notification: { id: string };
  try {
    notification = await prisma.notification.create({
      data: {
        ...(identity ? { id: identity.id } : {}),
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        listingId: input.listingId ?? null,
        reservationId: input.reservationId ?? null,
      },
      select: { id: true },
    });
  } catch (error) {
    if (identity && typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      // Another process may have won the insert after our read. Verify the exact
      // event before treating a unique violation as a duplicate; don't hide failures.
      const winner = await prisma.notification.findFirst({
        where: { ...identity.where, id: identity.id }, select: { id: true },
      });
      if (winner) return false;
    }
    throw error;
  }

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
  return true;
}
