import { useCallback, useEffect, useState } from "react";
import type { NotificationItem } from "@bitego/shared";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/api/notifications";

// Owner: Sachira. State management hook for notifications with pagination and mark-as-read.

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (targetPage = 1, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (targetPage === 1) {
        setLoading(true);
      }
      setError(null);

      const res = await fetchNotifications({ page: targetPage });

      setNotifications((prev) =>
        targetPage === 1 ? res.notifications : [...prev, ...res.notifications],
      );
      setUnreadCount(res.unreadCount);
      setHasMore(res.hasMore);
      setPage(targetPage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load notifications";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  const refresh = useCallback(async () => {
    await loadData(1, true);
  }, [loadData]);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || !hasMore) return;
    await loadData(page + 1, false);
  }, [loading, refreshing, hasMore, page, loadData]);

  const markOneRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await markNotificationRead(id);
    } catch {
      // Revert if API failed
      await refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      await markAllNotificationsRead();
    } catch {
      // Revert if API failed
      await refresh();
    }
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    refresh,
    loadMore,
    markOneRead,
    markAllRead,
  };
}

