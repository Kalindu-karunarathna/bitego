import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { fetchMyBusiness } from "@/api/seller";
import { useAuth } from "@/features/auth/AuthProvider";
import { color, formatShortDate } from "@/features/listings/design";
import { Icon } from "@/features/listings/Icon";
import { AppHeader, Badge, Btn, LoadError, Page, SkeletonCards, useFocusData } from "@/features/listings/kit";
import { BUSINESS_TYPE_LABELS } from "./ShopScreen";

// "Business verification" status from the design. Approval itself is done by the admin.
export function VerificationScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data: shop, error, retry } = useFocusData(fetchMyBusiness);
  const verification = profile?.business?.verification;
  const verified = profile?.business?.status === "ACTIVE";

  return (
    <Page header={<AppHeader title="Business verification" />}>
      {error && !shop ? <LoadError message={error} onRetry={retry} /> : null}
      {!error && !shop ? <SkeletonCards count={1} /> : null}
      {shop ? (
        <View style={styles.wrap}>
          <View style={[styles.icon, !verified && styles.iconPending]}>
            <Icon name={verified ? "shield" : "clock"} size={42} color={verified ? color.primary : color.warnText} />
          </View>
          <Text style={styles.title}>{verified ? "Verified business" : "Verification pending"}</Text>
          <Text style={styles.text}>
            {verified
              ? `${shop.name} has been approved as a trusted BiteGo food provider.`
              : "An admin is reviewing your business information."}
          </Text>
          {verified ? <Badge label="Verified business" tone="orange" icon="shield" style={styles.badge} /> : null}
          <View style={styles.info}>
            <InfoRow label="Business" value={shop.name} />
            <InfoRow label="Business type" value={BUSINESS_TYPE_LABELS[shop.type]} />
            {shop.registrationNo ? <InfoRow label="Registration no." value={shop.registrationNo} /> : null}
            {verification?.reviewedAt ? <InfoRow label="Verified on" value={formatShortDate(new Date(verification.reviewedAt))} last /> : null}
          </View>
          <Btn title="Back to account" variant="secondary" onPress={() => router.back()} style={styles.back} />
        </View>
      ) : null}
    </Page>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 36 },
  icon: { width: 84, height: 84, borderRadius: 25, backgroundColor: color.tint, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  iconPending: { backgroundColor: color.amberTint },
  title: { fontSize: 24, fontWeight: "800", color: color.text, letterSpacing: -0.5 },
  text: { fontSize: 14, lineHeight: 21, color: color.muted, textAlign: "center", marginTop: 8, paddingHorizontal: 16 },
  badge: { alignSelf: "center", marginTop: 14 },
  info: { alignSelf: "stretch", marginTop: 22, paddingHorizontal: 15, borderRadius: 17, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  row: { minHeight: 50, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: color.softLine },
  rowLabel: { fontSize: 13, color: color.muted },
  rowValue: { flex: 1, fontSize: 13, fontWeight: "700", color: color.text, textAlign: "right" },
  back: { alignSelf: "stretch", marginTop: 18 },
});
