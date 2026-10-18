import type { NotificationTypeName } from "@bitego/shared";
import { prisma } from "@/lib/prisma";

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
 * Saves an in-app notification for the user.
 * Silently skips if the user has turned notifications off in their preferences.
 * Push delivery will be added in feature/sachira-push-send (Week 4).
 */
export async function notify(input: NotifyInput): Promise<void> {
  // Respect the user's master notification toggle.
  // If no preference row exists yet, the default is enabled — so we proceed.
  const pref = await prisma.userPreference.findUnique({
    where: { userId: input.userId },
    select: { notificationsEnabled: true },
  });
  if (pref && !pref.notificationsEnabled) return;

  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      listingId: input.listingId ?? null,
      reservationId: input.reservationId ?? null,
    },
  });
}
