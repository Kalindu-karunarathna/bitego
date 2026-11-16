import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { DevicePlatform } from "@bitego/shared";
import { registerPushToken, removePushToken } from "@/api/notifications";

// Owner: Sachira.
// Hook that registers the device's Expo push token with the backend upon mount or manual trigger.
// Supports native Android, iOS, and gracefully handles Web & simulator environments.

export type PushPermissionStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

export type UsePushRegistrationOptions = {
  /** If false, won't auto-register on mount. Defaults to true. */
  autoRegister?: boolean;
};

export type UsePushRegistrationResult = {
  token: string | null;
  status: PushPermissionStatus;
  isRegistered: boolean;
  error: string | null;
  register: () => Promise<string | null>;
  unregister: () => Promise<boolean>;
};

// Minimal structural interface for Expo Notifications module (safe dynamic loading)
interface ExpoNotificationsLike {
  getPermissionsAsync?: () => Promise<{ status: string; granted: boolean }>;
  requestPermissionsAsync?: () => Promise<{ status: string; granted: boolean }>;
  getExpoPushTokenAsync?: (options?: { projectId?: string }) => Promise<{ data: string }>;
  setNotificationChannelAsync?: (
    channelId: string,
    channel: Record<string, unknown>,
  ) => Promise<unknown>;
  AndroidImportance?: {
    MAX: number;
    HIGH: number;
    DEFAULT: number;
  };
}

function loadExpoNotifications(): ExpoNotificationsLike | null {
  try {
    // Dynamic require allows building/running in any environment without hard crash
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications");
  } catch {
    return null;
  }
}

/**
 * Hook for managing Expo push notification permissions and device token registration.
 */
export function usePushRegistration(
  options: UsePushRegistrationOptions = {},
): UsePushRegistrationResult {
  const { autoRegister = true } = options;

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<PushPermissionStatus>("idle");
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registeringRef = useRef(false);

  const getPlatform = (): DevicePlatform => {
    return Platform.OS === "ios" ? "IOS" : "ANDROID";
  };

  /**
   * Requests push notification permissions and registers the token with the backend.
   */
  const register = useCallback(async (): Promise<string | null> => {
    if (registeringRef.current) return token;
    registeringRef.current = true;
    setError(null);

    // Web does not support native Expo push tokens
    if (Platform.OS === "web") {
      setStatus("unsupported");
      registeringRef.current = false;
      return null;
    }

    try {
      setStatus("requesting");
      const Notifications = loadExpoNotifications();
      let pushTokenString: string | null = null;

      if (Notifications?.requestPermissionsAsync && Notifications?.getExpoPushTokenAsync) {
        // Configure Android channel if available
        if (Platform.OS === "android" && Notifications.setNotificationChannelAsync) {
          try {
            await Notifications.setNotificationChannelAsync("bitego_default", {
              name: "BiteGo Notifications",
              importance: Notifications.AndroidImportance?.MAX ?? 5,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: "#E65100",
              sound: "default",
            });
          } catch {
            // Non-critical channel failure
          }
        }

        // Check permissions
        const permResult = await Notifications.requestPermissionsAsync();
        if (!permResult.granted && permResult.status !== "granted") {
          setStatus("denied");
          registeringRef.current = false;
          return null;
        }

        // Get actual Expo push token
        const tokenRes = await Notifications.getExpoPushTokenAsync();
        pushTokenString = tokenRes.data;
      } else {
        // Fallback for development/simulator environments without native expo-notifications build
        pushTokenString = `ExponentPushToken[SIMULATOR_${Platform.OS.toUpperCase()}_DEV]`;
      }

      if (!pushTokenString) {
        throw new Error("Failed to obtain device push token");
      }

      setStatus("granted");
      setToken(pushTokenString);

      // Register with BiteGo backend
      const platform = getPlatform();
      await registerPushToken({
        token: pushTokenString,
        platform,
      });

      setIsRegistered(true);
      registeringRef.current = false;
      return pushTokenString;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to register push token";
      // Don't crash the app if user is offline or not signed in yet
      setError(msg);
      setStatus("error");
      registeringRef.current = false;
      return null;
    }
  }, [token]);

  /**
   * Unregisters the current device push token on the backend (e.g. during logout).
   */
  const unregister = useCallback(async (): Promise<boolean> => {
    if (!token) return true;

    try {
      await removePushToken({ token });
      setToken(null);
      setIsRegistered(false);
      setStatus("idle");
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove push token";
      setError(msg);
      return false;
    }
  }, [token]);

  useEffect(() => {
    if (autoRegister) {
      void register();
    }
  }, [autoRegister, register]);

  return {
    token,
    status,
    isRegistered,
    error,
    register,
    unregister,
  };
}

