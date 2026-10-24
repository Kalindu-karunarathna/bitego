import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { NotificationItem } from "@bitego/shared";
import { useNotifications } from "@/features/notifications/useNotifications";
import { NotificationList } from "@/features/notifications/NotificationList";

// Owner: Sachira. Reusable Notifications screen used by both customer and business tabs.

export function NotificationsScreen({
  audience = "customer",
}: {
  audience?: "customer" | "business";
} = {}) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    refresh,
    loadMore,
    markOneRead,
    markAllRead,
  } = useNotifications();

  const handleNotificationPress = (item: NotificationItem) => {
    // Mark as read immediately on tap
    if (!item.isRead) {
      void markOneRead(item.id);
    }

    // Context-aware deep-linking based on notification content and audience
    if (item.reservationId) {
      if (audience === "customer") {
        router.push("/(customer)/reservations");
      } else {
        router.push("/(business)/orders");
      }
    } else if (item.listingId) {
      if (audience === "customer") {
        router.push("/(customer)/discover");
      } else {
        router.push("/(business)/sell");
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <NotificationList
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={refresh}
          onLoadMore={loadMore}
          onNotificationPress={handleNotificationPress}
          onMarkAllRead={markAllRead}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F5F0", // Matching Figma warm background
  },
  container: {
    flex: 1,
  },
});
