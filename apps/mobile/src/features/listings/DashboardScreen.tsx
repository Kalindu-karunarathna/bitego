import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import type { SellerListingDto, SellerOrderDto } from "@bitego/shared";
import { fetchMyListings, fetchOrders } from "@/api/seller";
import { useAuth } from "@/features/auth/AuthProvider";
import { color, formatEndsIn, formatLongDate, formatQuantity, greeting, images, isToday, reservationRef, shadow } from "./design";
import { Icon } from "./Icon";
import { ListingCard } from "./ListingCard";
import { Avatar, Badge, EmptyState, FoodImage, Gradient, LoadError, OrderBadge, Page, SectionHeading, SkeletonCards, TextLink, useFocusData } from "./kit";

const SOON_MS = 2 * 3600000;
const live = (l: SellerListingDto) => l.status === "ACTIVE" || l.status === "SOLD_OUT";

function MetricCard({ image, value, label, meta, wide, onPress }: { image: ImageSourcePropType; value: string; label: string; meta: string; wide?: boolean; onPress?: () => void }) {
  const body = (
    <>
      <View style={[styles.metricImage, wide && styles.metricImageWide]}>
        <Image source={image} style={styles.metricImg} resizeMode="contain" />
      </View>
      <View style={styles.flex}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.metricMeta} numberOfLines={1}>{meta}</Text>
      </View>
      {onPress ? <View style={styles.metricGo}><Icon name="chevron" size={18} color={color.primary} /></View> : null}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.metric, wide && styles.metricWide, pressed && styles.pressed]}>{body}</Pressable>
  ) : (
    <View style={styles.metric}>{body}</View>
  );
}

export function DashboardScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const load = useCallback(async () => {
    const [listings, orders] = await Promise.all([fetchMyListings(), fetchOrders("ALL")]);
    return { listings, orders };
  }, []);
  const { data, error, refreshing, refresh, retry } = useFocusData(load);

  const now = Date.now();
  const listings = data?.listings ?? [];
  const orders = data?.orders ?? [];
  const active = listings.filter(live);
  const createdToday = listings.filter((l) => isToday(new Date(l.createdAt))).length;
  const ordersToday = orders.filter((o) => isToday(new Date(o.createdAt)) && o.status !== "CANCELLED");
  const collectedToday = orders.filter((o) => o.status === "PICKED_UP" && o.pickedUpAt && isToday(new Date(o.pickedUpAt)));
  const available = active.reduce((sum, l) => sum + l.quantityAvailable, 0);
  const reserved = active.reduce((sum, l) => sum + l.quantityTotal - l.quantityAvailable, 0);
  const pickupsSoon = orders.filter((o) => o.status === "CONFIRMED" && new Date(o.listing.pickupEnd).getTime() - now < SOON_MS).length;
  const ending = [...active]
    .filter((l) => l.status === "ACTIVE" && new Date(l.pickupEnd).getTime() - now < 3 * 3600000)
    .sort((a, b) => new Date(a.pickupEnd).getTime() - new Date(b.pickupEnd).getTime())[0];
  const recent = orders.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);

  const goQuick = () => router.push("/sell/quick");

  return (
    <View style={styles.flex}>
      <Page padded={false} refreshing={refreshing} onRefresh={refresh}>
        <Gradient direction="vertical" stops={[[color.topGlow], [color.page]]} style={styles.topbar}>
          <View style={styles.brand}>
            <Image source={images.logoMark} style={styles.brandMark} resizeMode="contain" />
            <Text style={styles.brandText}>BiteGo</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/notifications")} style={styles.bell}>
            <Icon name="bell" size={24} color={color.text} />
            <View style={styles.bellDot} />
          </Pressable>
        </Gradient>

        <View style={styles.hero}>
          <Image source={images.heroBanner} style={styles.heroArt} resizeMode="cover" />
          <Gradient direction="horizontal" stops={[[color.heroBg, 1], [color.heroBg, 0.92], [color.heroBg, 0]]} style={styles.heroFade} />
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.businessName} numberOfLines={2}>{profile?.business?.name ?? "Your shop"}</Text>
            <Badge label="Verified business" tone="orange" icon="shield" style={styles.verified} />
          </View>
        </View>

        <View style={styles.body}>
          <SectionHeading
            title="Today at a glance"
            subtitle={formatLongDate(new Date())}
            action={pickupsSoon > 0 ? <Badge label={`${pickupsSoon} pickup${pickupsSoon === 1 ? "" : "s"} soon`} tone="orange" icon="clock" /> : undefined}
          />

          {error && !data ? <LoadError message={error} onRetry={retry} /> : null}
          {!error && !data ? <SkeletonCards count={2} /> : null}
          {data ? (
            <>
              <View style={styles.grid}>
                <MetricCard image={images.glanceBox} value={String(active.length)} label="Active listings" meta={`+${createdToday} today`} />
                <MetricCard image={images.glanceReceipt} value={String(ordersToday.length)} label="Reservations today" meta={`${collectedToday.length} collected`} />
                <MetricCard image={images.glanceFood} value={String(available)} label="Portions available" meta="Updates automatically" />
                <MetricCard image={images.glanceUsers} value={String(reserved)} label="Portions reserved" meta={`Across ${active.length} listing${active.length === 1 ? "" : "s"}`} />
              </View>
              <MetricCard
                wide
                image={images.glanceBag}
                value={String(collectedToday.reduce((sum, o) => sum + o.quantity, 0))}
                label="Picked up today"
                meta="See your activity"
                onPress={() => router.push("/sell/activity")}
              />

              <Pressable accessibilityRole="button" onPress={goQuick} style={({ pressed }) => [styles.quickWrap, pressed && styles.pressed]}>
                <Gradient stops={[[color.primaryDeep], [color.mid]]} style={styles.quick}>
                  <View style={styles.quickIcon}><Icon name="sparkles" size={24} color="#fff" /></View>
                  <View style={styles.flex}>
                    <Text style={styles.quickTag}>QUICK LISTING</Text>
                    <Text style={styles.quickTitle}>Publish surplus food in under a minute</Text>
                    <Text style={styles.quickSub}>Only the essentials — perfect for last-minute surplus</Text>
                  </View>
                  <Icon name="arrow" size={20} color="#fff" />
                </Gradient>
              </Pressable>
              <View style={styles.centerLink}>
                <TextLink title="Create detailed listing" icon="plus" onPress={() => router.push("/sell/new")} />
              </View>

              <SectionHeading title="Ending soon" subtitle="Act before these pickup windows close" action={<Badge label="Time sensitive" tone="orange" icon="clock" />} />
              {ending ? (
                <Pressable accessibilityRole="button" onPress={() => router.push(`/sell/${ending.id}`)} style={({ pressed }) => [styles.endingCard, pressed && styles.pressed]}>
                  <FoodImage uri={(ending.images.find((i) => i.isPrimary) ?? ending.images[0])?.imageUrl} style={styles.endingImage} />
                  <View style={styles.endingText}>
                    <Badge label="Ending soon" tone="orange" />
                    <Text style={styles.endingName} numberOfLines={1}>{ending.title}</Text>
                    <Text style={styles.endingLeft}>{formatQuantity(ending.quantityAvailable, ending.unit)} left</Text>
                    <View style={styles.endingRow}>
                      <Icon name="clock" size={14} color={color.warnText} />
                      <Text style={styles.endingTime}>Pickup ends in {formatEndsIn(ending.pickupEnd)}</Text>
                    </View>
                  </View>
                  <View style={styles.endingGo}><Icon name="chevron" size={18} color={color.warnText} /></View>
                </Pressable>
              ) : (
                <Text style={styles.quiet}>Nothing is ending in the next 3 hours.</Text>
              )}

              <SectionHeading
                title="Active surplus"
                subtitle="Quantities update with each reservation"
                action={<TextLink title="View all" onPress={() => router.push("/sell/listings")} />}
              />
              {active.length === 0 ? (
                <EmptyState icon="box" title="No active listings" text="Post your surplus food so nearby people can reserve it before closing time." />
              ) : (
                <View style={styles.list}>
                  {active.slice(0, 2).map((l) => (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      onPress={() => router.push(`/sell/${l.id}`)}
                      onEdit={() => router.push(`/sell/${l.id}/edit`)}
                      onReservations={() => router.push(`/sell/${l.id}`)}
                    />
                  ))}
                </View>
              )}

              <View style={styles.recentHeading}>
                <SectionHeading title="Recent reservations" subtitle="Latest customer activity" action={<TextLink title="View all" onPress={() => router.push("/orders")} />} />
              </View>
              {recent.length === 0 ? <Text style={styles.quiet}>No reservations yet.</Text> : null}
              {recent.map((o: SellerOrderDto) => (
                <Pressable key={o.id} accessibilityRole="button" onPress={() => router.push(`/orders/${o.id}`)} style={({ pressed }) => [styles.recent, pressed && styles.pressed]}>
                  <Avatar name={o.buyer.fullName} />
                  <View style={styles.flex}>
                    <Text style={styles.recentTitle} numberOfLines={1}>{o.buyer.fullName} · {formatQuantity(o.quantity, o.listing.unit)}</Text>
                    <Text style={styles.recentSub} numberOfLines={1}>{o.listing.title} · {reservationRef(o.id)}</Text>
                  </View>
                  <OrderBadge status={o.status} isNew={isToday(new Date(o.createdAt))} />
                </Pressable>
              ))}
            </>
          ) : null}
        </View>
      </Page>

      <Pressable accessibilityRole="button" accessibilityLabel="Quick listing" onPress={goQuick} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
        <Icon name="plus" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  list: { gap: 13 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMark: { width: 36, height: 36 },
  brandText: { fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: color.primary },
  bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bellDot: { position: "absolute", top: 8, right: 9, width: 10, height: 10, borderRadius: 5, backgroundColor: "#E8481C", borderWidth: 2, borderColor: color.page },
  hero: { marginHorizontal: 14, marginTop: 4, minHeight: 156, borderRadius: 20, overflow: "hidden", backgroundColor: color.heroBg, borderWidth: 1, borderColor: color.heroBorder, justifyContent: "center" },
  heroArt: { position: "absolute", right: 0, top: 0, bottom: 0, width: "62%", height: "100%" },
  heroFade: { position: "absolute", left: 0, top: 0, bottom: 0, width: "70%" },
  heroCopy: { paddingHorizontal: 18, paddingVertical: 20, maxWidth: "72%" },
  greeting: { fontSize: 16, color: "#6B5A4D" },
  businessName: { fontSize: 28, fontWeight: "800", color: color.brownText, letterSpacing: -0.8, marginTop: 2, marginBottom: 12 },
  verified: { paddingHorizontal: 13, paddingVertical: 8 },
  body: { paddingHorizontal: 18, paddingTop: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  metric: { width: "48.5%", flexGrow: 1, minHeight: 104, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface, ...shadow },
  metricWide: { width: "100%", backgroundColor: color.tintSoft, borderColor: color.tintBorder },
  metricImage: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.tintSoft, alignItems: "center", justifyContent: "center" },
  metricImageWide: { width: 60, height: 60, borderRadius: 30, backgroundColor: color.amberTint },
  metricImg: { width: "78%", height: "78%" },
  metricValue: { fontSize: 26, fontWeight: "800", letterSpacing: -0.7, color: color.text },
  metricLabel: { fontSize: 13, fontWeight: "700", color: color.text, marginTop: 1 },
  metricMeta: { fontSize: 11, color: color.muted, marginTop: 4 },
  metricGo: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFE0CC", alignItems: "center", justifyContent: "center" },
  quickWrap: { marginTop: 16, borderRadius: 18, ...shadow, shadowOpacity: 0.12 },
  quick: { borderRadius: 18, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  quickIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  quickTag: { alignSelf: "flex-start", fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: color.primaryDark, backgroundColor: "#FFD2AB", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: "hidden" },
  quickTitle: { fontSize: 15, fontWeight: "800", color: "#fff", marginTop: 7 },
  quickSub: { fontSize: 11, color: "rgba(255,255,255,0.78)", marginTop: 4 },
  centerLink: { alignItems: "center", marginTop: 6, marginBottom: 20 },
  endingCard: { flexDirection: "row", alignItems: "center", gap: 11, padding: 10, borderRadius: 17, borderWidth: 1, borderColor: color.amberBorder, backgroundColor: color.amberSoft, marginBottom: 24 },
  endingImage: { width: 74, height: 78, borderRadius: 12 },
  endingText: { flex: 1, minWidth: 0, gap: 4, alignItems: "flex-start" },
  endingName: { fontSize: 15, fontWeight: "800", color: color.text },
  endingLeft: { fontSize: 12, color: color.muted },
  endingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  endingTime: { fontSize: 12, fontWeight: "700", color: color.warnText },
  endingGo: { width: 34, height: 34, borderRadius: 10, backgroundColor: color.amberTint, alignItems: "center", justifyContent: "center" },
  quiet: { fontSize: 13, color: color.muted, marginBottom: 22 },
  recentHeading: { marginTop: 24 },
  recent: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 15, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface, marginBottom: 10 },
  recentTitle: { fontSize: 13, fontWeight: "700", color: color.text },
  recentSub: { fontSize: 11, color: color.muted, marginTop: 3 },
  fab: { position: "absolute", right: 18, bottom: 18, width: 56, height: 56, borderRadius: 18, borderWidth: 3, borderColor: color.page, backgroundColor: color.primary, alignItems: "center", justifyContent: "center", ...shadow, shadowOpacity: 0.3 },
});
