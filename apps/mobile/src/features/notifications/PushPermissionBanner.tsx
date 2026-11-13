import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { PushPermissionStatus } from "./usePushRegistration";

// Owner: Sachira.
// A banner displayed at the top of the Notifications list to prompt the user
// when push notifications are denied or disabled, or to confirm activation.

export type PushPermissionBannerProps = {
  status: PushPermissionStatus;
  onRequestPermission?: () => void;
  onDismiss?: () => void;
};

export function PushPermissionBanner({
  status,
  onRequestPermission,
  onDismiss,
}: PushPermissionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Only show if permission is denied or requesting, and not dismissed
  if (dismissed || status === "idle" || status === "unsupported" || status === "granted") {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.contentRow}>
        <Text style={styles.icon}>🔔</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {status === "denied"
              ? "Push Notifications Disabled"
              : "Connecting Push Notifications..."}
          </Text>
          <Text style={styles.description}>
            {status === "denied"
              ? "Enable notifications in device settings to get real-time alerts when fresh surplus food is posted nearby."
              : "Registering this device to receive instant reservation and pickup updates."}
          </Text>

          {status === "denied" && onRequestPermission && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onRequestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.actionText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Dismiss banner"
        >
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    backgroundColor: "#FFF8E1", // Soft warm amber
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE082",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  icon: {
    fontSize: 22,
    marginRight: 10,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
    paddingRight: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B78103",
    marginBottom: 3,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: "#5D4037",
  },
  actionButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#E65100",
    borderRadius: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  dismissButton: {
    padding: 4,
    marginLeft: 4,
  },
  dismissText: {
    fontSize: 14,
    color: "#8D6E63",
    fontWeight: "bold",
  },
});

