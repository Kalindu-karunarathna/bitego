import type { DevicePlatform, RegisterPushTokenInput, RemovePushTokenInput } from "@bitego/shared";
import { prisma } from "@/lib/prisma";

// Push token service. Owner: Sachira.
// Handles registering, updating, and removing Expo device push tokens in the database.

/**
 * Validates if a string matches the standard Expo push token pattern.
 * Supports ExponentPushToken[...], ExpoPushToken[...], or UUID format.
 */
export function isExpoPushToken(token: string): boolean {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  return (
    ((trimmed.startsWith("ExponentPushToken[") || trimmed.startsWith("ExpoPushToken[")) &&
      trimmed.endsWith("]")) ||
    /^[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/i.test(trimmed)
  );
}

/**
 * Registers or updates a device push token for a user.
 * If the device token already exists (e.g. user re-logged in or another user
 * logged into the same device), we reassign the owner to this user and update
 * the platform and lastSeenAt timestamp.
 */
export async function upsertDeviceToken(
  userId: string,
  input: RegisterPushTokenInput,
) {
  const token = input.token.trim();
  const platform = input.platform as DevicePlatform;
  const now = new Date();

  const record = await prisma.deviceToken.upsert({
    where: { token },
    update: {
      userId,
      platform,
      lastSeenAt: now,
    },
    create: {
      userId,
      token,
      platform,
      lastSeenAt: now,
    },
    select: {
      id: true,
      userId: true,
      token: true,
      platform: true,
      lastSeenAt: true,
    },
  });

  return {
    registered: true,
    id: record.id,
    token: record.token,
    platform: record.platform,
    lastSeenAt: record.lastSeenAt.toISOString(),
  };
}

/**
 * Removes a specific device push token for a user upon logout.
 * Uses deleteMany with both token and userId so a user cannot delete someone else's token.
 */
export async function removeDeviceToken(
  userId: string,
  input: RemovePushTokenInput,
) {
  const token = input.token.trim();

  const result = await prisma.deviceToken.deleteMany({
    where: {
      token,
      userId,
    },
  });

  return { removed: result.count > 0 };
}

/**
 * Removes all device push tokens for a user (e.g. on global account sign-out).
 */
export async function removeAllDeviceTokens(userId: string) {
  const result = await prisma.deviceToken.deleteMany({
    where: { userId },
  });

  return { removedCount: result.count };
}

/**
 * Retrieves all registered active device tokens for a user.
 * (Will be utilized by the push notification sender in Day 19).
 */
export async function getUserDeviceTokens(userId: string) {
  const rows = await prisma.deviceToken.findMany({
    where: { userId },
    select: {
      id: true,
      token: true,
      platform: true,
      lastSeenAt: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    token: row.token,
    platform: row.platform,
    lastSeenAt: row.lastSeenAt.toISOString(),
  }));
}

