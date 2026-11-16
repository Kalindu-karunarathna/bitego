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

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  badge?: number;
};

export type PushSendResult = {
  sent: number;
  failed: number;
  staleTokensRemoved: number;
};

/**
 * Sends an Expo push notification to all active devices registered to a user.
 * Communicates directly with the Expo Push HTTP/2 API via native fetch (no external npm dependencies).
 * Automatically detects and deletes stale uninstalled tokens (DeviceNotRegistered).
 */
export async function sendPush(
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  try {
    const deviceTokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (deviceTokens.length === 0) {
      return { sent: 0, failed: 0, staleTokensRemoved: 0 };
    }

    const validTokens = deviceTokens.filter((d) => isExpoPushToken(d.token));
    if (validTokens.length === 0) {
      return { sent: 0, failed: 0, staleTokensRemoved: 0 };
    }

    const messages = validTokens.map((d) => ({
      to: d.token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      channelId: payload.channelId ?? "bitego_default",
      priority: payload.priority ?? "high",
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    }));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    };

    const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;
    if (expoAccessToken) {
      headers["Authorization"] = `Bearer ${expoAccessToken}`;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Expo Push] HTTP error ${response.status}: ${errorText}`);
      return { sent: 0, failed: messages.length, staleTokensRemoved: 0 };
    }

    const resJson = (await response.json()) as {
      data?: Array<{
        status: "ok" | "error";
        id?: string;
        message?: string;
        details?: { error?: string };
      }>;
      errors?: Array<{ message: string; code?: string }>;
    };

    let sent = 0;
    let failed = 0;
    const staleTokens: string[] = [];

    if (Array.isArray(resJson.data)) {
      resJson.data.forEach((ticket, idx) => {
        const targetToken = validTokens[idx]?.token;
        if (ticket.status === "ok") {
          sent += 1;
        } else {
          failed += 1;
          if (ticket.details?.error === "DeviceNotRegistered" && targetToken) {
            staleTokens.push(targetToken);
          }
        }
      });
    }

    let staleTokensRemoved = 0;
    if (staleTokens.length > 0) {
      const del = await prisma.deviceToken.deleteMany({
        where: { token: { in: staleTokens } },
      });
      staleTokensRemoved = del.count;
    }

    return { sent, failed, staleTokensRemoved };
  } catch (err) {
    console.error(`[Expo Push] Unexpected error sending push to user ${userId}:`, err);
    return { sent: 0, failed: 1, staleTokensRemoved: 0 };
  }
}

