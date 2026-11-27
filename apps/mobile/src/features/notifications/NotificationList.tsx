import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NotificationItem as NotificationItemType } from "@bitego/shared";
import { NotificationItem } from "@/features/notifications/NotificationItem";
import { theme } from "@/lib/theme";

// Owner: Sachira. Complete list component matching the Figma design.

export function NotificationList({
  notifications,
  unreadCount,
  loading,
  refreshing,
  error,
  onRefresh,
  onLoadMore,
  onNotificationPress,
  onMarkAllRead,
}: {
  notifications: NotificationItemType[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onLoadMore?: () => void;
  onNotificationPress: (item: NotificationItemType) => void;
  onMarkAllRead: () => void;
}) {
  const renderHeader = () => (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </Text>
      </View>

      {unreadCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={onMarkAllRead}
          hitSlop={8}
          style={({ pressed }) => pressed && { opacity: 0.7 }}
        >
          <Text style={styles.markAllRead}>Mark all read</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#E65100" />
          <Text style={styles.emptyText}>Loading notifications...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🔔</Text>
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptyText}>
          When food is ready, expiring, or reserved, alerts will appear here.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRefresh} hitSlop={6}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem item={item} onPress={onNotificationPress} />
        )}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#E65100"]}
            tintColor="#E65100"
          />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5F0", // Warm cream/beige background matching Figma
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1C1B1A",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#7E7A75",
    marginTop: 3,
    fontWeight: "500",
  },
  markAllRead: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E65100", // Vibrant orange from Figma
    paddingBottom: 4,
  },
  listContent: {
    paddingBottom: 40,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1B1A",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#8A8680",
    textAlign: "center",
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: theme.radius,
    backgroundColor: "#FDECEA",
  },
  errorText: {
    fontSize: 13,
    color: theme.danger,
    flex: 1,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.danger,
    marginLeft: 12,
  },
});

