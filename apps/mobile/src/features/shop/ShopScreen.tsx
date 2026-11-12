import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { BusinessType } from "@bitego/shared";
import { fetchMyBusiness } from "@/api/seller";
import { useAuth } from "@/features/auth/AuthProvider";
import { color, images, shadow } from "@/features/listings/design";
import { Icon, type IconName } from "@/features/listings/Icon";
import { Badge, ConfirmDialog, LoadError, NoticeDialog, Page, SkeletonCards, useFocusData } from "@/features/listings/kit";

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  RESTAURANT: "Restaurant",
  CAFE: "Café",
  BAKERY: "Bakery",
  SUPERMARKET: "Supermarket",
  CANTEEN: "Canteen",
  HOTEL: "Hotel",
  SHOP: "Shop",
  OTHER: "Other",
};

type Row = { icon: IconName; label: string; sub?: string; to?: Href };
const groups: { title: string; rows: Row[] }[] = [
  { title: "Personal account", rows: [{ icon: "user", label: "Personal Information" }, { icon: "phone", label: "Contact Information" }] },
  {
    title: "Business account",
    rows: [
      { icon: "store", label: "Business Profile", to: "/shop/edit" },
      { icon: "shield", label: "Business Verification", to: "/shop/verification" },
      { icon: "pin", label: "Shop Location", to: "/shop/location" },
      { icon: "clock", label: "Opening Hours" },
      { icon: "box", label: "Pickup Settings" },
    ],
  },
  { title: "Preferences", rows: [{ icon: "bell", label: "Notification Settings" }, { icon: "moon", label: "Dark Mode", sub: "Off" }] },
  { title: "Security & privacy", rows: [{ icon: "lock", label: "Change Password" }, { icon: "shield", label: "Privacy & Permissions" }] },
  {
    title: "Support",
    rows: [
      { icon: "help", label: "Help Center & FAQs", to: "/shop/info?page=help" },
      { icon: "mail", label: "Contact Support" },
      { icon: "receipt", label: "Terms & Conditions", to: "/shop/info?page=terms" },
      { icon: "info", label: "About BiteGo", to: "/shop/info?page=about" },
    ],
  },
  { title: "More", rows: [{ icon: "settings", label: "Additional Settings" }] },
];

// The design's Account screen. Rows without a backend yet open a "coming soon" message.
export function ShopScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { data: shop, error, refreshing, refresh, retry } = useFocusData(fetchMyBusiness);
  const [loggingOut, setLoggingOut] = useState(false);
  const [soon, setSoon] = useState<string | null>(null);
  const verified = profile?.business?.status === "ACTIVE";

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <Text style={styles.title}>Account</Text>
      {error && !shop ? <LoadError message={error} onRetry={retry} /> : null}
      {!error && !shop ? <SkeletonCards count={1} /> : null}
      {shop ? (
        <Pressable accessibilityRole="button" onPress={() => router.push("/shop/edit")} style={({ pressed }) => [styles.shopCard, pressed && styles.pressed]}>
          <View style={styles.logo}>
            {shop.logoUrl ? <Image source={{ uri: shop.logoUrl }} style={styles.logoImage} /> : <Image source={images.logoMark} style={styles.logoMark} resizeMode="contain" />}
          </View>
          <View style={styles.flex}>
            <Text style={styles.shopName} numberOfLines={2}>{shop.name}</Text>
            <Text style={styles.shopSub}>{BUSINESS_TYPE_LABELS[shop.type]} · Manage your business account</Text>
            {verified ? <Badge label="Verified business" tone="orange" icon="shield" /> : null}
          </View>
          <Icon name="chevron" size={18} color={color.muted} />
        </Pressable>
      ) : null}

      {shop ? (
        <View style={styles.stats}>
          <Stat value={String(shop.stats.activeListings)} label="Active listings" />
          <Stat value={String(shop.stats.itemsRescued)} label="Items rescued" divider />
          <Stat value={shop.stats.averageRating === null ? "–" : `${shop.stats.averageRating.toFixed(1)} ★`} label={shop.stats.reviewCount === 1 ? "1 review" : `${shop.stats.reviewCount} reviews`} divider />
        </View>
      ) : null}

      {groups.map((g) => (
        <View key={g.title} style={styles.group}>
          <Text style={styles.groupTitle}>{g.title.toUpperCase()}</Text>
          <View style={styles.menu}>
            {g.rows.map((r, i) => (
              <Pressable
                key={r.label}
                accessibilityRole="button"
                onPress={() => (r.to ? router.push(r.to) : setSoon(r.label))}
                style={({ pressed }) => [styles.row, i < g.rows.length - 1 && styles.rowBorder, pressed && styles.pressed]}
              >
                <View style={styles.rowIcon}><Icon name={r.icon} size={18} color={color.primary} /></View>
                <View style={styles.flex}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  {r.label === "Business Verification" ? <Text style={styles.rowSub}>{verified ? "Verified" : "Pending"}</Text> : r.sub ? <Text style={styles.rowSub}>{r.sub}</Text> : !r.to ? <Text style={styles.rowSoon}>Coming soon</Text> : null}
                </View>
                <Icon name="chevron" size={18} color="#9CA3AF" />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Pressable accessibilityRole="button" onPress={() => setLoggingOut(true)} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
        <Icon name="logout" size={20} color={color.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
      <Text style={styles.version}>BiteGo for Business · v1.0.0</Text>

      <ConfirmDialog
        visible={loggingOut}
        icon="logout"
        title="Log out?"
        message="You'll need to log in again to manage your listings."
        confirmLabel="Log out"
        onConfirm={() => {
          setLoggingOut(false);
          void signOut();
        }}
        onClose={() => setLoggingOut(false)}
      />
      <NoticeDialog
        visible={soon !== null}
        title={`${soon ?? ""} is coming soon`}
        message="This part of the account isn't available in BiteGo yet. Your listings, reservations and shop profile work as normal."
        onClose={() => setSoon(null)}
      />
    </Page>
  );
}

function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, color: color.text, paddingTop: 10, paddingBottom: 12 },
  shopCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface, ...shadow },
  logo: { width: 60, height: 60, borderRadius: 17, backgroundColor: color.tintSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImage: { width: "100%", height: "100%" },
  logoMark: { width: "70%", height: "70%" },
  shopName: { fontSize: 17, fontWeight: "800", color: color.text },
  shopSub: { fontSize: 12, color: color.muted, marginTop: 2, marginBottom: 6 },
  stats: { flexDirection: "row", marginTop: 12, paddingVertical: 14, borderRadius: 16, backgroundColor: color.tintSoft, borderWidth: 1, borderColor: color.tintBorder },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: color.tintBorder },
  statValue: { fontSize: 18, fontWeight: "800", color: color.primary },
  statLabel: { fontSize: 11, color: color.muted },
  group: { marginTop: 20 },
  groupTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: color.muted, marginLeft: 6, marginBottom: 8 },
  menu: { paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface },
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: color.softLine },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: color.tintSoft, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 14, fontWeight: "700", color: color.text },
  rowSub: { fontSize: 12, color: color.primary, marginTop: 1 },
  rowSoon: { fontSize: 11, color: color.muted2, marginTop: 1 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 50, marginTop: 22, borderRadius: 13, backgroundColor: color.errorTint },
  logoutText: { fontSize: 14, fontWeight: "700", color: color.error },
  version: { fontSize: 11, color: color.muted, textAlign: "center", marginTop: 14 },
});
