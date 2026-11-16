import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { fetchMyBusiness, fetchOrder } from "@/api/seller";
import { color, formatDay, formatPrice, formatQuantity, formatTime, formatWindow, reservationRef } from "./design";
import { Icon } from "./Icon";
import { AppHeader, Avatar, Btn, FoodImage, InfoIcon, LoadError, OrderBadge, Page, SkeletonCards, useFocusData } from "./kit";

const STATUS_TEXT = {
  CONFIRMED: "Waiting for the customer to collect",
  PICKED_UP: "Collected",
  CANCELLED: "Cancelled",
  EXPIRED: "Not collected before the deadline",
} as const;

export function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const load = useCallback(async () => {
    const [order, shop] = await Promise.all([fetchOrder(id), fetchMyBusiness()]);
    return { order, shop };
  }, [id]);
  const { data, error, retry } = useFocusData(load);
  const header = <AppHeader title="Reservation details" />;

  if (!data) return <Page header={header}>{error ? <LoadError message={error} onRetry={retry} /> : <SkeletonCards count={2} />}</Page>;

  const { order, shop } = data;
  const phone = order.buyer.phone;
  const placed = new Date(order.createdAt);

  return (
    <Page
      header={header}
      footer={order.status === "CONFIRMED" ? <Btn title="Verify pickup" icon="check" onPress={() => router.push("/orders/verify")} /> : undefined}
    >
      <View style={styles.status}>
        <View style={styles.statusText}>
          <OrderBadge status={order.status} />
          <Text style={styles.ref}>{reservationRef(order.id)}</Text>
          <Text style={styles.small}>Reserved {formatDay(placed).toLowerCase()} at {formatTime(placed)} · {STATUS_TEXT[order.status]}</Text>
        </View>
        <View style={styles.statusIcon}><Icon name="receipt" size={28} color={color.warnText} /></View>
      </View>

      <Section title="Customer">
        <View style={styles.customer}>
          <Avatar name={order.buyer.fullName} large />
          <View style={styles.flex}>
            <Text style={styles.bold}>{order.buyer.fullName}</Text>
            <View style={styles.phoneRow}>
              <Icon name={order.buyer.isBusiness ? "store" : "phone"} size={14} color={color.muted} />
              <Text style={styles.small}>{order.buyer.isBusiness ? "Business buyer" : phone ?? "No phone number given"}</Text>
            </View>
            {order.buyer.isBusiness && phone ? <Text style={styles.small}>{phone}</Text> : null}
          </View>
          {phone ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Call ${order.buyer.fullName}`} onPress={() => void Linking.openURL(`tel:${phone}`)} style={({ pressed }) => [styles.call, pressed && styles.pressed]}>
              <Icon name="phone" size={17} color={color.primary} />
              <Text style={styles.callText}>Call</Text>
            </Pressable>
          ) : null}
        </View>
      </Section>

      <Section title="Order">
        <View style={styles.orderRow}>
          <FoodImage uri={order.listing.imageUrl} style={styles.orderImage} />
          <View style={styles.flex}>
            <Text style={styles.bold}>{order.listing.title}</Text>
            <Text style={styles.small}>{formatPrice(order.unitPrice)} × {formatQuantity(order.quantity, order.listing.unit)}</Text>
          </View>
          <Text style={styles.bold}>{formatPrice(order.totalPrice)}</Text>
        </View>
        <View style={styles.total}>
          <Text style={styles.totalLabel}>{order.totalPrice === 0 ? "Free food" : order.status === "PICKED_UP" ? "Collected" : "Total to collect"}</Text>
          <Text style={styles.totalValue}>{formatPrice(order.totalPrice)}</Text>
        </View>
      </Section>

      <Section title="Pickup">
        <PickupRow icon="clock" label="Pickup window" value={formatWindow(order.listing.pickupStart, order.listing.pickupEnd)} sub="Customer must collect before the deadline." />
        <PickupRow icon="pin" label="Location" value={shop.name} sub={[shop.addressLine, shop.city].join(", ")} />
        {order.cancelReason ? <PickupRow icon="info" label="Cancel reason" value={order.cancelReason} /> : null}
      </Section>

      <View style={styles.noDelivery}>
        <Icon name="store" color={color.primary} />
        <View style={styles.flex}>
          <Text style={styles.noDeliveryTitle}>Customer pickup only</Text>
          <Text style={styles.small}>Ask for the 6-digit pickup code before handing over the food.</Text>
        </View>
      </View>
    </Page>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PickupRow({ icon, label, value, sub }: { icon: "clock" | "pin" | "info"; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.pickupRow}>
      <InfoIcon icon={icon} />
      <View style={styles.flex}>
        <Text style={styles.small}>{label}</Text>
        <Text style={styles.bold}>{value}</Text>
        {sub ? <Text style={styles.small}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16, borderRadius: 17, borderWidth: 1, borderColor: color.amberBorder, backgroundColor: color.amberSoft, marginBottom: 13 },
  statusText: { flex: 1, gap: 6, alignItems: "flex-start" },
  statusIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: color.amberTint, alignItems: "center", justifyContent: "center" },
  ref: { fontSize: 18, fontWeight: "800", color: color.text },
  small: { fontSize: 12, color: color.muted, marginTop: 1 },
  bold: { fontSize: 14, fontWeight: "700", color: color.text },
  section: { padding: 15, borderRadius: 17, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface, marginBottom: 13 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: color.text, marginBottom: 12 },
  customer: { flexDirection: "row", alignItems: "center", gap: 10 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  call: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: color.lineStrong, backgroundColor: color.surface },
  callText: { fontSize: 13, fontWeight: "700", color: color.primary },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orderImage: { width: 56, height: 56, borderRadius: 10 },
  total: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: color.softLine },
  totalLabel: { fontSize: 14, color: color.text },
  totalValue: { fontSize: 18, fontWeight: "800", color: color.primary },
  pickupRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 8 },
  noDelivery: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 14, backgroundColor: color.tintSoft },
  noDeliveryTitle: { fontSize: 14, fontWeight: "700", color: color.primary },
});
