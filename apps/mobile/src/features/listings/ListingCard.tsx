import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SellerListingDto } from "@bitego/shared";
import { color, formatPrice, formatQuantity, formatTime, isToday, formatDay, shadow } from "./design";
import { Icon } from "./Icon";
import { Badge, FoodImage, LIMITED_AT, listingState } from "./kit";

// One listing, as on the design's dashboard and listings page: photo with status, price, what's left,
// a reserved-vs-remaining bar, then Edit and Reservations.
export function ListingCard({
  listing,
  onPress,
  onEdit,
  onReservations,
  compact = false,
}: {
  listing: SellerListingDto;
  onPress?: () => void;
  onEdit?: () => void;
  onReservations?: () => void;
  compact?: boolean;
}) {
  const state = listingState(listing);
  const primary = listing.images.find((i) => i.isPrimary) ?? listing.images[0];
  const reserved = listing.quantityTotal - listing.quantityAvailable;
  const progress = listing.quantityTotal > 0 ? reserved / listing.quantityTotal : 0;
  const low = listing.quantityAvailable <= LIMITED_AT;
  const end = new Date(listing.pickupEnd);
  const until = isToday(end) ? formatTime(end) : `${formatDay(end)} ${formatTime(end)}`;
  const live = listing.status === "ACTIVE" || listing.status === "SOLD_OUT";

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, compact && styles.cardCompact, pressed && styles.pressed]}>
      <View style={[styles.main, compact && styles.mainCompact]}>
        <View style={[styles.imageWrap, compact && styles.imageCompact]}>
          <FoodImage uri={primary?.imageUrl} style={styles.image} />
          <Badge label={state.label} tone={state.tone} dot upper={false} style={styles.imageBadge} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>{listing.title}</Text>
          <Text style={styles.price}>
            {formatPrice(listing.price)} <Text style={styles.priceNote}>customer price</Text>
          </Text>
          <View style={styles.meta}>
            <View style={styles.metaRow}>
              <Icon name="box" size={14} color={low ? "#A55D06" : color.muted} />
              <Text style={[styles.metaText, low && styles.metaLow]}>{formatQuantity(listing.quantityAvailable, listing.unit)} left</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="clock" size={14} color={color.muted} />
              <Text style={styles.metaText}>Until {until}</Text>
            </View>
          </View>
        </View>
      </View>

      {compact ? null : (
        <>
          <View style={styles.progressWrap}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>{reserved} reserved</Text>
              <Text style={styles.progressText}>{listing.quantityAvailable} remaining</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} /></View>
          </View>
          <View style={styles.actions}>
            {live && onEdit ? (
              <Pressable accessibilityRole="button" onPress={onEdit} style={({ pressed }) => [styles.action, styles.actionNarrow, pressed && styles.pressed]}>
                <Icon name="edit" size={16} color={color.muted} />
                <Text style={styles.actionText}>Edit</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={onReservations ?? onPress} style={({ pressed }) => [styles.action, styles.actionWide, pressed && styles.pressed]}>
              <Icon name="users" size={16} color={color.primary} />
              <Text style={[styles.actionText, { color: color.primary }]}>Reservations</Text>
              <Icon name="chevron" size={14} color={color.primary} />
            </Pressable>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  card: { backgroundColor: color.surface, borderRadius: 18, borderWidth: 1, borderColor: color.softLine, padding: 10, ...shadow },
  cardCompact: { padding: 11, shadowOpacity: 0, elevation: 0 },
  main: { flexDirection: "row", gap: 12 },
  mainCompact: { alignItems: "center" },
  imageWrap: { width: 98, height: 104, borderRadius: 13, overflow: "hidden" },
  imageCompact: { width: 76, height: 76 },
  image: { width: "100%", height: "100%", borderRadius: 0 },
  imageBadge: { position: "absolute", left: 6, bottom: 6 },
  info: { flex: 1, minWidth: 0, paddingTop: 3 },
  name: { fontSize: 16, fontWeight: "800", color: color.text, letterSpacing: -0.3 },
  price: { fontSize: 17, fontWeight: "800", color: color.primary, marginTop: 6, marginBottom: 8 },
  priceNote: { fontSize: 11, fontWeight: "500", color: color.muted },
  meta: { gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, color: color.muted },
  metaLow: { color: "#A55D06", fontWeight: "700" },
  progressWrap: { marginTop: 12, marginBottom: 10, marginHorizontal: 1 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  progressText: { fontSize: 11, color: color.muted },
  track: { height: 6, borderRadius: 99, backgroundColor: "#F1E6DA", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 99, backgroundColor: color.light },
  actions: { flexDirection: "row", gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: color.softLine },
  action: { minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  actionNarrow: { flex: 0.8 },
  actionWide: { flex: 1.4, backgroundColor: color.tintSoft, borderColor: color.tintBorder },
  actionText: { fontSize: 13, fontWeight: "700", color: color.muted },
});
