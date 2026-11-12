import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { cancelListing, fetchMyListing, fetchOrders } from "@/api/seller";
import { color, formatMoney, formatPrice, formatQuantity, formatWindow, reservationRef } from "./design";
import { Icon } from "./Icon";
import {
  AppHeader,
  Avatar,
  Badge,
  Btn,
  ConfirmDialog,
  EmptyState,
  errorMessage,
  Field,
  FoodImage,
  FormError,
  InfoIcon,
  listingState,
  LoadError,
  OrderBadge,
  Page,
  SectionHeading,
  SkeletonCards,
  useFocusData,
} from "./kit";

const AUDIENCE_LABELS = { EVERYONE: "Everyone", CUSTOMERS_ONLY: "Customers only", BUSINESSES_ONLY: "Businesses only" } as const;

export function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const load = useCallback(async () => {
    const [listing, orders] = await Promise.all([fetchMyListing(id), fetchOrders("ALL", id)]);
    return { listing, orders };
  }, [id]);
  const { data, setData, error, retry, refreshing, refresh } = useFocusData(load);

  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!data) {
    return (
      <Page header={<AppHeader title="Listing details" />}>
        {error ? <LoadError message={error} onRetry={retry} /> : <SkeletonCards count={2} />}
      </Page>
    );
  }

  const { listing, orders } = data;
  const state = listingState(listing);
  const editable = listing.status === "ACTIVE" || listing.status === "SOLD_OUT";
  const primary = listing.images.find((i) => i.isPrimary) ?? listing.images[0];
  const save = listing.originalPrice - listing.price;
  const reserved = listing.quantityTotal - listing.quantityAvailable;

  async function doCancel() {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await cancelListing(listing.id, { reason: reason.trim() || undefined });
      setData({ listing: updated, orders: await fetchOrders("ALL", id) });
      setConfirming(false);
    } catch (err) {
      setConfirming(false);
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      header={<AppHeader title="Listing details" />}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={
        editable ? (
          <>
            <FormError>{actionError}</FormError>
            <View style={styles.footerRow}>
              <Btn title="Cancel" icon="close" variant="secondary" onPress={() => setConfirming(true)} style={styles.footerNarrow} />
              <Btn title="Edit listing" icon="edit" onPress={() => router.push(`/sell/${listing.id}/edit`)} style={styles.flex} />
            </View>
          </>
        ) : undefined
      }
      overlay={
        <ConfirmDialog
          visible={confirming}
          title="Cancel this listing?"
          message={
            listing.reservations.active > 0
              ? `${listing.reservations.active === 1 ? "1 reservation" : `${listing.reservations.active} reservations`} will also be cancelled, and the buyers will be notified. This cannot be undone.`
              : "Buyers will no longer see this food. This cannot be undone."
          }
          confirmLabel="Cancel listing"
          cancelLabel="Keep it"
          busy={busy}
          onConfirm={() => void doCancel()}
          onClose={() => setConfirming(false)}
        >
          <Field label="Reason" optional placeholder="e.g. Food finished early" value={reason} onChangeText={setReason} />
        </ConfirmDialog>
      }
    >
      <View style={styles.card}>
        <View style={styles.imageWrap}>
          <FoodImage uri={primary?.imageUrl} style={styles.image} />
          <Badge label={state.label} tone={state.tone} dot upper={false} style={styles.stateBadge} />
          <Text style={styles.pickupOnly}>PICKUP ONLY</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.category}>{listing.category.name}</Text>
          <Text style={styles.name}>{listing.title}</Text>
          <View style={styles.pricing}>
            <Text style={styles.price}>{formatPrice(listing.price)}</Text>
            {save > 0 ? (
              <>
                <Text style={styles.oldPrice}>{formatMoney(listing.originalPrice)}</Text>
                <Text style={styles.saveTag}>Save {formatMoney(save)}</Text>
              </>
            ) : null}
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>{reserved} reserved</Text>
              <Text style={styles.progressText}>{formatQuantity(listing.quantityAvailable, listing.unit)} remaining of {listing.quantityTotal}</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${listing.quantityTotal ? Math.round((reserved / listing.quantityTotal) * 100) : 0}%` }]} /></View>
          </View>

          <Row icon="clock" tone="amber" label="Pickup window" value={formatWindow(listing.pickupStart, listing.pickupEnd)} sub={listing.pickupNote ?? "Expires automatically when pickup ends."} />
          <Row icon="users" label="Who can reserve" value={AUDIENCE_LABELS[listing.audience]} />
          {listing.description ? <Text style={styles.description}>{listing.description}</Text> : null}
        </View>
      </View>

      <View style={styles.reservationsHead}>
        <SectionHeading title="Reservations" subtitle={`${listing.reservations.active} waiting · ${listing.reservations.pickedUp} picked up`} />
      </View>
      {orders.length === 0 ? (
        <EmptyState icon="receipt" title="No reservations yet" text="Reservations for this food will appear here." />
      ) : (
        <View style={styles.list}>
          {orders.map((o) => (
            <Pressable key={o.id} accessibilityRole="button" onPress={() => router.push(`/orders/${o.id}`)} style={({ pressed }) => [styles.order, pressed && styles.pressed]}>
              <Avatar name={o.buyer.fullName} />
              <View style={styles.flex}>
                <Text style={styles.orderName} numberOfLines={1}>{o.buyer.fullName} · {formatQuantity(o.quantity, listing.unit)}</Text>
                <Text style={styles.orderSub}>{reservationRef(o.id)} · {formatPrice(o.totalPrice)}</Text>
              </View>
              <OrderBadge status={o.status} />
            </Pressable>
          ))}
        </View>
      )}
    </Page>
  );
}

function Row({ icon, label, value, sub, tone }: { icon: "clock" | "users"; label: string; value: string; sub?: string; tone?: "amber" }) {
  return (
    <View style={styles.row}>
      <InfoIcon icon={icon} tone={tone} />
      <View style={styles.flex}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  list: { gap: 10 },
  footerRow: { flexDirection: "row", gap: 8 },
  footerNarrow: { flex: 0.7 },
  card: { borderRadius: 21, overflow: "hidden", backgroundColor: color.surface, borderWidth: 1, borderColor: color.softLine },
  imageWrap: { height: 230 },
  image: { width: "100%", height: "100%", borderRadius: 0 },
  stateBadge: { position: "absolute", left: 13, bottom: 13 },
  pickupOnly: { position: "absolute", right: 13, bottom: 13, backgroundColor: color.primary, color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.6, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, overflow: "hidden" },
  body: { padding: 17 },
  category: { fontSize: 13, fontWeight: "700", color: color.primary },
  name: { fontSize: 24, fontWeight: "800", color: color.text, marginTop: 4, marginBottom: 8 },
  pricing: { flexDirection: "row", alignItems: "center", gap: 8 },
  price: { fontSize: 22, fontWeight: "800", color: color.primary },
  oldPrice: { fontSize: 13, color: "#9CA3AF", textDecorationLine: "line-through" },
  saveTag: { fontSize: 11, fontWeight: "700", color: color.primary, backgroundColor: color.tint, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, overflow: "hidden" },
  progressWrap: { marginTop: 16, marginBottom: 4 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressText: { fontSize: 12, color: color.muted },
  track: { height: 7, borderRadius: 99, backgroundColor: "#F1E6DA", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 99, backgroundColor: color.light },
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  rowLabel: { fontSize: 11, color: color.muted },
  rowValue: { fontSize: 14, fontWeight: "700", color: color.text, marginTop: 2 },
  rowSub: { fontSize: 12, color: color.muted, marginTop: 2 },
  description: { fontSize: 13, lineHeight: 20, color: color.muted, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: color.softLine },
  reservationsHead: { marginTop: 22 },
  order: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 15, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface },
  orderName: { fontSize: 13, fontWeight: "700", color: color.text },
  orderSub: { fontSize: 11, color: color.muted, marginTop: 3 },
});
