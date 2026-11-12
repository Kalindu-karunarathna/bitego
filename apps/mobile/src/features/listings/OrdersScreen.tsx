import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SellerOrderDto } from "@bitego/shared";
import { fetchOrders } from "@/api/seller";
import { color, formatDay, formatPrice, formatQuantity, formatShortDate, formatTime, formatWindow, isToday, reservationRef, shadow } from "./design";
import { Icon } from "./Icon";
import { Avatar, Btn, EmptyState, FoodImage, Gradient, LoadError, OrderBadge, Page, PillTabs, SimpleHeader, SkeletonCards, useFocusData } from "./kit";

type Tab = "upcoming" | "picked" | "history";

// Defined outside the component so it stays the same function between renders.
const loadAll = () => fetchOrders("ALL");

const inTab = (o: SellerOrderDto, tab: Tab) =>
  tab === "upcoming" ? o.status === "CONFIRMED" : tab === "picked" ? o.status === "PICKED_UP" : o.status === "CANCELLED" || o.status === "EXPIRED";

const EMPTY: Record<Tab, { title: string; text: string }> = {
  upcoming: { title: "No upcoming pickups", text: "When someone reserves your food, it will appear here." },
  picked: { title: "No completed pickups", text: "Orders you hand over will appear here." },
  history: { title: "No cancelled or missed pickups", text: "Cancelled reservations and no-shows will appear here." },
};

export function ReservationCard({ order, onOpen, onVerify }: { order: SellerOrderDto; onOpen: () => void; onVerify?: () => void }) {
  const picked = order.status === "PICKED_UP" && order.pickedUpAt;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Avatar name={order.buyer.fullName} />
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>{order.buyer.fullName}{order.buyer.isBusiness ? " · Business" : ""}</Text>
          <Text style={styles.ref}>{reservationRef(order.id)} • {formatShortDate(new Date(order.createdAt))}</Text>
        </View>
        <OrderBadge status={order.status} isNew={isToday(new Date(order.createdAt))} />
      </View>
      <View style={styles.food}>
        <FoodImage uri={order.listing.imageUrl} style={styles.foodImage} />
        <View style={styles.flex}>
          <Text style={styles.foodName} numberOfLines={1}>{order.listing.title}</Text>
          <Text style={styles.foodMeta}>{formatQuantity(order.quantity, order.listing.unit)} • {formatPrice(order.totalPrice)}</Text>
        </View>
      </View>
      <View style={styles.time}>
        <Icon name="clock" size={17} color={color.warnText} />
        <View>
          <Text style={styles.timeLabel}>{picked ? "Collected" : order.status === "EXPIRED" ? "Deadline passed" : "Pickup window"}</Text>
          <Text style={styles.timeValue}>
            {picked ? `${formatDay(new Date(order.pickedUpAt!))}, ${formatTime(new Date(order.pickedUpAt!))}` : formatWindow(order.listing.pickupStart, order.listing.pickupEnd)}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Btn title="View details" variant="secondary" iconRight="chevron" small onPress={onOpen} style={onVerify ? styles.narrow : styles.flex} />
        {onVerify ? <Btn title="Verify pickup" icon="check" small onPress={onVerify} style={styles.wide} /> : null}
      </View>
    </View>
  );
}

export function OrdersScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const { data, error, refreshing, refresh, retry } = useFocusData(loadAll);

  const all = data ?? [];
  const shown = all.filter((o) => inTab(o, tab));
  const todayCount = all.filter((o) => o.status === "CONFIRMED" && isToday(new Date(o.listing.pickupEnd))).length;

  return (
    <Page padded={false} refreshing={refreshing} onRefresh={refresh}>
      <Gradient direction="vertical" stops={[[color.topGlow], [color.page]]}>
        <SimpleHeader
          title="Reservations"
          subtitle="Prepare and verify pickups quickly"
          action={
            <Pressable accessibilityRole="button" accessibilityLabel="Check a pickup code" onPress={() => router.push("/orders/verify")} style={styles.scanBtn}>
              <Icon name="shield" color={color.primary} />
            </Pressable>
          }
        />
      </Gradient>
      <View style={styles.tabs}>
        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: "Upcoming", icon: "receipt", count: all.filter((o) => inTab(o, "upcoming")).length },
            { value: "picked", label: "Picked up", icon: "check", count: all.filter((o) => inTab(o, "picked")).length },
            { value: "history", label: "History", icon: "clock", count: all.filter((o) => inTab(o, "history")).length },
          ]}
        />
      </View>
      <View style={styles.content}>
        {data ? (
          <View style={styles.dateRow}>
            <Text style={styles.dateTitle}>{tab === "upcoming" ? "Today" : tab === "picked" ? "Collected" : "Closed"}</Text>
            <Text style={styles.dateSub}>{tab === "upcoming" ? `${todayCount} pickup${todayCount === 1 ? "" : "s"} due today` : `${shown.length} reservation${shown.length === 1 ? "" : "s"}`}</Text>
          </View>
        ) : null}
        {error && !data ? <LoadError message={error} onRetry={retry} /> : null}
        {!error && !data ? <SkeletonCards /> : null}
        {data && shown.length === 0 ? <EmptyState icon="receipt" {...EMPTY[tab]} /> : null}
        <View style={styles.list}>
          {shown.map((o) => (
            <ReservationCard
              key={o.id}
              order={o}
              onOpen={() => router.push(`/orders/${o.id}`)}
              onVerify={o.status === "CONFIRMED" ? () => router.push("/orders/verify") : undefined}
            />
          ))}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  narrow: { flex: 0.8 },
  wide: { flex: 1.2 },
  scanBtn: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: "#FAD9BF", backgroundColor: color.tintSoft, alignItems: "center", justifyContent: "center" },
  tabs: { paddingHorizontal: 14 },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 11 },
  dateTitle: { fontSize: 16, fontWeight: "800", color: color.text },
  dateSub: { fontSize: 12, color: color.muted },
  list: { gap: 13 },
  card: { padding: 13, borderRadius: 18, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface, ...shadow },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { fontSize: 14, fontWeight: "700", color: color.text },
  ref: { fontSize: 11, color: color.muted, marginTop: 2 },
  food: { flexDirection: "row", alignItems: "center", gap: 10, padding: 9, borderRadius: 13, backgroundColor: color.page, marginVertical: 12 },
  foodImage: { width: 52, height: 52, borderRadius: 10 },
  foodName: { fontSize: 14, fontWeight: "700", color: color.text },
  foodMeta: { fontSize: 12, color: color.muted, marginTop: 3 },
  time: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  timeLabel: { fontSize: 11, color: color.muted },
  timeValue: { fontSize: 13, fontWeight: "700", color: color.text, marginTop: 1 },
  actions: { flexDirection: "row", gap: 7 },
});
