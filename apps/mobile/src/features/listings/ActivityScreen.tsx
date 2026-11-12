import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { ActivityPeriod, SellerActivityDto } from "@bitego/shared";
import { fetchActivity } from "@/api/seller";
import { color, formatMoney, images, weekdayLetter } from "./design";
import { Icon, type IconName } from "./Icon";
import { AppHeader, Badge, Gradient, LoadError, NoticeDialog, Page, SkeletonCards, useFocusData } from "./kit";

const PERIODS: { value: ActivityPeriod; label: string; previous: string }[] = [
  { value: "TODAY", label: "Today", previous: "yesterday" },
  { value: "WEEK", label: "This week", previous: "the week before" },
  { value: "MONTH", label: "This month", previous: "the same time before" },
];

function change(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "New this period" : "No change";
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct === 0 ? "Same as before" : `${Math.abs(pct)}% ${pct > 0 ? "more" : "less"} than before`;
}

export function ActivityScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<ActivityPeriod>("MONTH");
  const [menuOpen, setMenuOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const load = useCallback(() => fetchActivity(period), [period]);
  const { data, error, refreshing, refresh, retry } = useFocusData(load);
  const periodInfo = PERIODS.find((p) => p.value === period)!;
  const a: SellerActivityDto | null = data && data.period === period ? data : null;
  const collectedOfReserved = a && a.completionRate !== null ? Math.round((a.completionRate * a.portionsReserved) / 100) : 0;

  const periodButton = (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: menuOpen }} onPress={() => setMenuOpen(!menuOpen)} style={styles.periodBtn}>
      <Icon name="calendar" size={16} color={color.muted} />
      <Text style={styles.periodText}>{periodInfo.label}</Text>
      <Icon name="chevronDown" size={14} color={color.muted} />
    </Pressable>
  );

  return (
    <Page header={<AppHeader title="Activity" action={periodButton} />} refreshing={refreshing} onRefresh={refresh}>
      {menuOpen ? (
        <View style={styles.menu}>
          {PERIODS.map((p) => (
            <Pressable key={p.value} accessibilityRole="button" onPress={() => { setPeriod(p.value); setMenuOpen(false); }} style={[styles.menuItem, p.value === period && styles.menuActive]}>
              <Text style={[styles.menuText, p.value === period && { color: color.primary }]}>{p.label}</Text>
              {p.value === period ? <Icon name="check" size={16} color={color.primary} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.intro}>Your surplus impact at a glance</Text>
      {error && !a ? <LoadError message={error} onRetry={retry} /> : null}
      {!error && !a ? <SkeletonCards count={2} /> : null}
      {a ? (
        <>
          <Gradient stops={[[color.primaryDark], [color.primary]]} style={styles.hero}>
            <View style={styles.heroLeaf}><Icon name="leaf" size={30} color="#fff" /></View>
            <View style={styles.flex}>
              <Text style={styles.heroSmall}>Estimated waste reduced</Text>
              <Text style={styles.heroValue}>{a.portionsCollected} portions</Text>
              <View style={styles.heroTrend}>
                <Icon name="trend" size={14} color="#FFD2AB" />
                <Text style={styles.heroTrendText}>{change(a.portionsCollected, a.previousPortionsCollected)}</Text>
              </View>
            </View>
            <Image source={images.bowl} style={styles.heroArt} resizeMode="contain" />
          </Gradient>

          <View style={styles.grid}>
            <Stat icon="box" value={String(a.listingsCreated)} label="Surplus listings" meta={change(a.listingsCreated, a.previousListingsCreated)} onPress={() => router.push("/sell/listings")} />
            <Stat icon="receipt" value={String(a.portionsReserved)} label="Portions reserved" meta={`${a.portionsAwaiting} awaiting pickup`} onPress={() => router.push("/orders")} />
            <Stat icon="check" value={String(a.portionsCollected)} label="Portions collected" meta={a.portionsCollected > 0 ? "Good impact!" : "None yet"} onPress={() => router.push("/orders")} />
            <Stat icon="wallet" value={formatMoney(a.revenue)} label="Revenue generated" meta={change(a.revenue, a.previousRevenue)} onPress={() => setRevenueOpen(true)} />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardTitle}>Portions collected</Text>
                <Text style={styles.cardSub}>Last 7 days</Text>
              </View>
              <Text style={styles.cardTotal}>{a.last7Days.reduce((sum, d) => sum + d.collected, 0)} <Text style={styles.cardSub}>total</Text></Text>
            </View>
            <BarChart days={a.last7Days} />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardTitle}>Pickup completion</Text>
                <Text style={styles.cardSub}>Reserved vs. collected</Text>
              </View>
              <Badge label={a.completionRate === null ? "No data" : `${a.completionRate}% rate`} />
            </View>
            <View style={styles.donutRow}>
              <Donut collected={collectedOfReserved} awaiting={a.portionsAwaiting} cancelled={a.portionsCancelled} rate={a.completionRate} total={a.portionsReserved} />
              <View style={styles.legend}>
                <Legend dot={color.mid} text={`${collectedOfReserved} Collected`} />
                <Legend dot={color.amber} text={`${a.portionsAwaiting} Awaiting pickup`} />
                <Legend dot="#D1D5DB" text={`${a.portionsCancelled} Cancelled`} />
              </View>
            </View>
          </View>

          <View style={styles.message}>
            <Icon name="sparkles" color={color.warnText} />
            <View style={styles.flex}>
              <Text style={styles.messageTitle}>{a.portionsCollected > 0 ? "Your surplus is making a difference" : "Every listing helps"}</Text>
              <Text style={styles.messageText}>
                {a.portionsCollected > 0
                  ? `${a.portionsCollected} portions found a home instead of going to waste ${periodInfo.label.toLowerCase()}.`
                  : "Post your surplus food so nearby people can reserve it before it goes to waste."}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {a ? (
        <NoticeDialog
          visible={revenueOpen}
          icon="wallet"
          title={`Revenue · ${formatMoney(a.revenue)}`}
          message={
            a.revenueByListing.length
              ? a.revenueByListing.map((r) => `${r.title} · ${r.portions} portions · ${formatMoney(r.revenue)}`).join("\n")
              : `No paid pickups ${periodInfo.label.toLowerCase()}.`
          }
          onClose={() => setRevenueOpen(false)}
        />
      ) : null}
    </Page>
  );
}

function Stat({ icon, value, label, meta, onPress }: { icon: IconName; value: string; label: string; meta: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.stat, pressed && styles.pressed]}>
      <View style={styles.statIcon}><Icon name={icon} size={20} color={color.primary} /></View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statMeta} numberOfLines={1}>{meta}</Text>
      <View style={styles.statGo}><Icon name="chevron" size={12} color={color.primary} /></View>
    </Pressable>
  );
}

function BarChart({ days }: { days: { date: string; collected: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.collected));
  return (
    <View style={styles.bars}>
      {days.map((d) => (
        <View key={d.date} style={styles.barColumn}>
          <Text style={styles.barValue}>{d.collected || ""}</Text>
          <View style={styles.barTrack}>
            <Gradient direction="vertical" stops={[[color.light], [color.primary]]} style={[styles.barFill, { height: `${Math.max(4, (d.collected / max) * 100)}%` }]} />
          </View>
          <Text style={styles.barDay}>{weekdayLetter(new Date(`${d.date}T12:00:00`))}</Text>
        </View>
      ))}
    </View>
  );
}

function Donut({ collected, awaiting, cancelled, rate, total }: { collected: number; awaiting: number; cancelled: number; rate: number | null; total: number }) {
  const size = 104;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sum = Math.max(1, collected + awaiting + cancelled);
  const parts = [
    { value: collected, color: color.mid },
    { value: awaiting, color: color.amber },
    { value: cancelled, color: "#D1D5DB" },
  ];
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.softLine} strokeWidth={stroke} fill="none" />
        {parts.map((p, i) => {
          const len = (p.value / sum) * c;
          const el = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={p.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return p.value > 0 ? el : null;
        })}
      </Svg>
      <Text style={styles.donutValue}>{rate === null ? "–" : `${rate}%`}</Text>
      <Text style={styles.donutSub}>of {total}</Text>
    </View>
  );
}

function Legend({ dot, text }: { dot: string; text: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: dot }]} />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  periodBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  periodText: { fontSize: 12, fontWeight: "700", color: color.muted },
  menu: { alignSelf: "flex-end", width: 170, marginBottom: 8, padding: 5, borderRadius: 12, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface },
  menuItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10, borderRadius: 8 },
  menuActive: { backgroundColor: color.tintSoft },
  menuText: { fontSize: 14, fontWeight: "600", color: color.text },
  intro: { fontSize: 13, color: color.muted, marginBottom: 12 },
  hero: { borderRadius: 19, padding: 18, flexDirection: "row", alignItems: "center", gap: 13 },
  heroLeaf: { width: 56, height: 56, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  heroSmall: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  heroValue: { fontSize: 26, fontWeight: "800", color: "#fff", marginTop: 2 },
  heroTrend: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  heroTrendText: { fontSize: 12, color: "#FFD2AB" },
  heroArt: { width: 70, height: 72 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: 13 },
  stat: { width: "48.5%", flexGrow: 1, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface },
  statIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: color.tint, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statValue: { fontSize: 21, fontWeight: "800", color: color.text },
  statLabel: { fontSize: 13, fontWeight: "600", color: color.text, marginTop: 2 },
  statMeta: { fontSize: 11, color: color.muted, marginTop: 3 },
  statGo: { position: "absolute", top: 12, right: 12, width: 22, height: 22, borderRadius: 11, backgroundColor: color.tintSoft, alignItems: "center", justifyContent: "center" },
  card: { padding: 15, borderRadius: 17, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface, marginBottom: 13 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: color.text },
  cardSub: { fontSize: 11, fontWeight: "400", color: color.muted, marginTop: 2 },
  cardTotal: { fontSize: 20, fontWeight: "800", color: color.primary },
  bars: { height: 150, flexDirection: "row", alignItems: "flex-end", gap: 9, paddingTop: 14 },
  barColumn: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 5 },
  barValue: { fontSize: 10, color: color.muted, height: 13 },
  barTrack: { width: 18, flex: 1, borderRadius: 7, backgroundColor: color.tintSoft, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 7 },
  barDay: { fontSize: 11, color: color.muted },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 16 },
  donutValue: { fontSize: 20, fontWeight: "800", color: color.text },
  donutSub: { fontSize: 11, color: color.muted },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: color.muted },
  message: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, backgroundColor: color.amberSoft },
  messageTitle: { fontSize: 14, fontWeight: "700", color: color.text, marginBottom: 3 },
  messageText: { fontSize: 12, lineHeight: 18, color: color.muted },
});
