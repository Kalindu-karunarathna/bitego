import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NotificationItem as NotificationItemType, NotificationTypeName } from "@bitego/shared";
import { theme } from "@/lib/theme";

// Owner: Sachira. Single notification item card matching the Figma UI design.

export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return past.toLocaleDateString();
}

type IconConfig = {
  symbol: string;
  bgColor: string;
  color: string;
};

function getIconConfig(type: NotificationTypeName): IconConfig {
  switch (type) {
    case "PICKUP_REMINDER":
    case "LISTING_NEARING_EXPIRY":
      return { symbol: "⏱", bgColor: "#FFEAD9", color: "#E65100" };
    case "NEW_NEARBY_LISTING":
    case "NEW_RESERVATION":
      return { symbol: "🔔", bgColor: "#FFEAD9", color: "#E65100" };
    case "RESERVATION_CONFIRMED":
    case "BUSINESS_APPROVED":
      return { symbol: "✓", bgColor: "#E8F5E9", color: "#2E7D32" };
    case "RESERVATION_CANCELLED":
    case "BUSINESS_REJECTED":
      return { symbol: "✕", bgColor: "#F5F5F5", color: "#B71C1C" };
    case "LISTING_SOLD_OUT":
      return { symbol: "🏷", bgColor: "#FFEAD9", color: "#E65100" };
    default:
      return { symbol: "★", bgColor: "#FFF8E1", color: "#F57F17" };
  }
}

export const NotificationItem = memo(function NotificationItem({
  item,
  onPress,
}: {
  item: NotificationItemType;
  onPress: (item: NotificationItemType) => void;
}) {
  const icon = getIconConfig(item.type);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: icon.bgColor }]}>
        <Text style={[styles.iconText, { color: icon.color }]}>{icon.symbol}</Text>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
      </View>

      {!item.isRead ? <View style={styles.unreadDot} /> : <View style={styles.dotPlaceholder} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: "#F2EFE9",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  iconText: {
    fontSize: 18,
    fontWeight: "700",
  },
  textContainer: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#222222",
    lineHeight: 20,
  },
  message: {
    fontSize: 13.5,
    color: "#5C5C5C",
    lineHeight: 18,
  },
  time: {
    fontSize: 12,
    color: "#9C9C96",
    marginTop: 3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E65100",
    marginTop: 8,
  },
  dotPlaceholder: {
    width: 8,
  },
});

