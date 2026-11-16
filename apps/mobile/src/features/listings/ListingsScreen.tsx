import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { SellerListingDto } from "@bitego/shared";
import { fetchMyListings } from "@/api/seller";
import { color } from "./design";
import { Icon } from "./Icon";
import { ListingCard } from "./ListingCard";
import { Btn, EmptyState, Gradient, LIMITED_AT, LoadError, Page, PillTabs, SimpleHeader, SkeletonCards, useFocusData } from "./kit";

type Tab = "active" | "ended" | "cancelled";

function inTab(listing: SellerListingDto, tab: Tab) {
  if (tab === "active") return listing.status === "ACTIVE" || listing.status === "SOLD_OUT";
  if (tab === "ended") return listing.status === "COMPLETED" || listing.status === "EXPIRED";
  return listing.status === "CANCELLED";
}

const EMPTY: Record<Tab, { title: string; text: string }> = {
  active: { title: "No active listings", text: "Post your surplus food so nearby people can reserve it." },
  ended: { title: "No expired listings", text: "Sold and expired listings will appear here." },
  cancelled: { title: "No cancelled listings", text: "Listings you cancel will appear here." },
};

export function ListingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const { data, error, refreshing, refresh, retry } = useFocusData(fetchMyListings);

  const all = data ?? [];
  const count = (t: Tab) => all.filter((l) => inTab(l, t)).length;
  const shown = useMemo(
    () =>
      all.filter(
        (l) =>
          inTab(l, tab) &&
          l.title.toLowerCase().includes(query.trim().toLowerCase()) &&
          (!lowOnly || tab !== "active" || l.quantityAvailable <= LIMITED_AT),
      ),
    [all, tab, query, lowOnly],
  );
  const accepting = all.filter((l) => l.status === "ACTIVE").length;
  const goCreate = () => router.push("/sell/new");

  return (
    <Page padded={false} refreshing={refreshing} onRefresh={refresh}>
      <Gradient direction="vertical" stops={[[color.topGlow], [color.page]]}>
        <SimpleHeader
          title="Surplus listings"
          subtitle="Manage everything you've made available"
          action={
            <Pressable accessibilityRole="button" accessibilityLabel="Create listing" onPress={goCreate} style={({ pressed }) => [styles.addWrap, pressed && styles.pressed]}>
              <Gradient stops={[[color.mid], [color.primary]]} style={styles.add}><Icon name="plus" size={24} color="#fff" /></Gradient>
            </Pressable>
          }
        />
      </Gradient>

      <View style={styles.tabs}>
        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "Active", icon: "receipt", count: count("active") },
            { value: "ended", label: "Expired", icon: "clock", count: count("ended") },
            { value: "cancelled", label: "Cancelled", icon: "close", count: count("cancelled") },
          ]}
        />
      </View>

      <View style={styles.content}>
        {tab === "active" && data ? (
          <>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.summary}>
              <View style={styles.summaryLeft}>
                <View style={styles.liveDot} />
                <Text style={styles.summaryText}>{accepting} listing{accepting === 1 ? "" : "s"} accepting reservations</Text>
              </View>
              <View style={styles.summaryLeft}>
                <Text style={styles.updated}>{refreshing ? "Updating…" : "Pull to update"}</Text>
                <Icon name="trend" size={14} color={color.primary} />
              </View>
            </Pressable>
            <View style={styles.searchRow}>
              <View style={styles.search}>
                <Icon name="search" size={18} color={color.muted} />
                <TextInput
                  accessibilityLabel="Search your listings"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search your listings..."
                  placeholderTextColor={color.muted2}
                  style={styles.searchInput}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: lowOnly }}
                onPress={() => setLowOnly(!lowOnly)}
                style={[styles.filter, lowOnly && styles.filterOn]}
              >
                <Icon name="filter" size={16} color={lowOnly ? color.primary : color.text} />
                <Text style={[styles.filterText, lowOnly && { color: color.primary }]}>Filter</Text>
              </Pressable>
            </View>
            {lowOnly ? <Text style={styles.filterNote}>Showing limited stock only ({LIMITED_AT} or fewer left)</Text> : null}
          </>
        ) : null}

        {error && !data ? <LoadError message={error} onRetry={retry} /> : null}
        {!error && !data ? <SkeletonCards /> : null}
        {data && shown.length === 0 ? (
          <EmptyState
            icon="box"
            title={query || lowOnly ? "No listings found" : EMPTY[tab].title}
            text={query || lowOnly ? "Try a different search or clear the filter." : EMPTY[tab].text}
            action={tab === "active" && !query && !lowOnly ? <Btn title="Create listing" icon="plus" onPress={goCreate} style={styles.emptyBtn} /> : undefined}
          />
        ) : null}
        <View style={styles.list}>
          {shown.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              onPress={() => router.push(`/sell/${l.id}`)}
              onEdit={() => router.push(`/sell/${l.id}/edit`)}
              onReservations={() => router.push(`/sell/${l.id}`)}
            />
          ))}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  addWrap: { borderRadius: 16, shadowColor: color.primary, shadowOpacity: 0.32, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  add: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tabs: { paddingHorizontal: 14 },
  content: { paddingHorizontal: 18, paddingTop: 14 },
  summary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10, borderRadius: 12, backgroundColor: color.tintSoft, marginBottom: 10 },
  summaryLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.success },
  summaryText: { fontSize: 12, fontWeight: "600", color: color.primary },
  updated: { fontSize: 11, color: color.muted },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: color.text },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  filterOn: { backgroundColor: color.tintSoft, borderColor: color.primary },
  filterText: { fontSize: 13, fontWeight: "600", color: color.text },
  filterNote: { fontSize: 12, color: color.primary, marginTop: -4, marginBottom: 10 },
  list: { gap: 13 },
  emptyBtn: { marginTop: 14, alignSelf: "stretch" },
});
