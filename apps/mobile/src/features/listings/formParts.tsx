import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CategoryDto, ListingAudience, SellerBusinessDto, SellerListingDto } from "@bitego/shared";
import { ApiRequestError } from "@/api/client";
import { color, formatDay, formatTime, startOfDay } from "./design";
import { Icon, type IconName } from "./Icon";
import { ListingCard } from "./ListingCard";
import { Btn, Chips, Page, Stepper, SuccessIcon } from "./kit";

// Pieces shared by the quick and the detailed listing forms.

export type PriceType = "free" | "discounted" | "custom";

export const STEP_MS = 15 * 60000;
const DAY_MS = 86400000;

export function nextQuarterHour(): Date {
  return new Date(Math.ceil(Date.now() / STEP_MS) * STEP_MS);
}

export const toNumber = (text: string) => (text.trim() === "" ? undefined : Number(text.replace(/,/g, "")));

// Errors from the API that belong to one input.
export const CODE_FIELDS: Record<string, string> = {
  CATEGORY_NOT_AVAILABLE: "categoryId",
  CATEGORY_NOT_B2B_SUITABLE: "categoryId",
  QUANTITY_BELOW_RESERVED: "quantityTotal",
  PICKUP_ALREADY_ENDED: "pickupEnd",
  PICKUP_WINDOW_LOCKED: "pickupEnd",
  INVALID_PICKUP_WINDOW: "pickupEnd",
  INVALID_PRICE: "price",
};
export const fieldForError = (err: unknown) => (err instanceof ApiRequestError ? CODE_FIELDS[err.code] : undefined);

export const AUDIENCES: { value: ListingAudience; label: string; hint: string }[] = [
  { value: "EVERYONE", label: "Everyone", hint: "Customers and other businesses can reserve this." },
  { value: "CUSTOMERS_ONLY", label: "Customers only", hint: "Only customers can see and reserve this." },
  { value: "BUSINESSES_ONLY", label: "Businesses only", hint: "Only other businesses can reserve this. Needs a B2B-suitable category." },
];

// Prices for the API from the selected price type.
export function pricesFor(type: PriceType, price: string, originalPrice: string) {
  if (type === "free") return { price: 0, originalPrice: toNumber(originalPrice) ?? 0 };
  const customer = toNumber(price);
  if (type === "custom") return { price: customer, originalPrice: customer };
  return { price: customer, originalPrice: toNumber(originalPrice) };
}

export function priceTypeOf(listing: SellerListingDto): PriceType {
  if (listing.price === 0) return "free";
  return listing.originalPrice > listing.price ? "discounted" : "custom";
}

const PRICE_OPTIONS: { value: PriceType; label: string; sub: string; icon?: IconName }[] = [
  { value: "free", label: "Free", sub: "Give away", icon: "leaf" },
  { value: "discounted", label: "Discounted", sub: "Reduced price" },
  { value: "custom", label: "Custom price", sub: "Set amount" },
];

export function PriceSelector({ value, onChange }: { value: PriceType; onChange: (v: PriceType) => void }) {
  return (
    <View style={styles.priceRow}>
      {PRICE_OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(o.value)} style={[styles.priceOption, active && styles.priceActive]}>
            {o.icon ? <Icon name={o.icon} size={17} color={active ? color.primary : color.muted} /> : null}
            <Text style={[styles.priceLabel, active && { color: color.primary }]}>{o.label}</Text>
            <Text style={[styles.priceSub, active && { color: color.primary }]}>{o.sub}</Text>
            {active ? <View style={styles.priceCheck}><Icon name="check" size={11} color="#fff" strokeWidth={2.6} /></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function CategoryChips({
  categories,
  existing,
  audience,
  value,
  onChange,
  error,
}: {
  categories: CategoryDto[];
  existing?: SellerListingDto | null;
  audience: ListingAudience;
  value: string | null;
  onChange: (v: string) => void;
  error?: string;
}) {
  // A hidden category stays selectable on a listing that already uses it.
  const options = [...categories];
  if (existing && !options.some((c) => c.id === existing.category.id)) {
    options.unshift({ ...existing.category, description: null, iconUrl: null, b2bSuitability: "RESTRICTED" });
  }
  return (
    <Chips
      label="Category"
      options={options.map((c) => ({ value: c.id, label: c.name, disabled: audience === "BUSINESSES_ONLY" && c.b2bSuitability !== "SUITABLE" }))}
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}

// Today/Tomorrow plus start and end steppers in 15-minute steps.
export function PickupTimes({
  start,
  end,
  setStart,
  setEnd,
}: {
  start: Date;
  end: Date;
  setStart: (d: Date) => void;
  setEnd: (d: Date) => void;
}) {
  const dayOffset = Math.round((startOfDay(start).getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
  function chooseDay(offset: number) {
    const shift = startOfDay(new Date()).getTime() + offset * DAY_MS - startOfDay(start).getTime();
    setStart(new Date(start.getTime() + shift));
    setEnd(new Date(end.getTime() + shift));
  }
  return (
    <>
      <Chips<string>
        options={[{ value: "0", label: "Today" }, { value: "1", label: "Tomorrow" }]}
        value={dayOffset === 0 || dayOffset === 1 ? String(dayOffset) : null}
        onChange={(v) => chooseDay(Number(v))}
      />
      <View style={styles.timeBox}>
        <TimeRow
          label="Pickup starts"
          date={start}
          onMinus={() => setStart(new Date(start.getTime() - STEP_MS))}
          onPlus={() => {
            const next = new Date(start.getTime() + STEP_MS);
            setStart(next);
            if (end <= next) setEnd(new Date(next.getTime() + STEP_MS));
          }}
        />
        <View style={styles.divider} />
        <TimeRow
          label="Pickup ends"
          date={end}
          minusDisabled={end.getTime() - STEP_MS <= start.getTime()}
          onMinus={() => setEnd(new Date(end.getTime() - STEP_MS))}
          onPlus={() => setEnd(new Date(end.getTime() + STEP_MS))}
        />
      </View>
    </>
  );
}

function TimeRow({ label, date, onMinus, onPlus, minusDisabled }: { label: string; date: Date; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean }) {
  return (
    <View style={styles.timeRow}>
      <View>
        <Text style={styles.timeLabel}>{label}</Text>
        <Text style={styles.timeDay}>{formatDay(date)}</Text>
      </View>
      <Stepper label={label} value={formatTime(date)} onMinus={onMinus} onPlus={onPlus} minusDisabled={minusDisabled} />
    </View>
  );
}

export function LocationCard({ shop }: { shop: SellerBusinessDto | null }) {
  return (
    <View style={styles.location}>
      <View style={styles.locationIcon}><Icon name="store" size={20} color={color.primary} /></View>
      <View style={styles.flex}>
        <Text style={styles.locationName}>{shop?.name ?? "Your shop"}</Text>
        <Text style={styles.locationAddress} numberOfLines={2}>{shop ? [shop.addressLine, shop.city].join(", ") : "Loading address…"}</Text>
      </View>
      <Icon name="check" size={18} color={color.mid} />
    </View>
  );
}

// "Listing is live!" after publishing.
export function PublishedView({ listing, title, text, quick }: { listing: SellerListingDto; title: string; text: string; quick?: boolean }) {
  const router = useRouter();
  const end = new Date(listing.pickupEnd);
  return (
    <Page>
      <View style={styles.success}>
        <SuccessIcon />
        <Text style={styles.successTitle}>{title}</Text>
        <Text style={styles.successText}>{text}</Text>
      </View>
      {quick ? (
        <View style={styles.summary}>
          <SummaryRow icon="box" title={`${listing.quantityAvailable} available`} sub="Quantity goes down with each reservation" />
          <SummaryRow icon="clock" title={`Pickup ${formatTime(new Date(listing.pickupStart))} – ${formatTime(end)}`} sub={`Expires automatically at ${formatTime(end)}`} />
          <SummaryRow icon="bell" title="Automatic updates are on" sub="Nearby buyers are told about new food" last />
        </View>
      ) : (
        <View style={styles.published}>
          <ListingCard listing={listing} compact />
          <View style={styles.publishNote}>
            <Icon name="clock" size={20} color={color.warnText} />
            <View style={styles.flex}>
              <Text style={styles.publishNoteTitle}>Available until {formatTime(end)}</Text>
              <Text style={styles.publishNoteSub}>It will expire automatically after pickup ends.</Text>
            </View>
          </View>
        </View>
      )}
      <View style={styles.successActions}>
        <Btn title="View listing" iconRight="arrow" onPress={() => router.replace(`/sell/${listing.id}`)} />
        <Btn title="Back to dashboard" variant="ghost" onPress={() => router.dismissTo("/sell")} />
      </View>
    </Page>
  );
}

function SummaryRow({ icon, title, sub, last }: { icon: IconName; title: string; sub: string; last?: boolean }) {
  return (
    <View style={[styles.summaryRow, !last && styles.summaryBorder]}>
      <Icon name={icon} color={color.primary} />
      <View style={styles.flex}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summarySub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  priceRow: { flexDirection: "row", gap: 7, marginTop: 14 },
  priceOption: { flex: 1, minHeight: 82, borderRadius: 13, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 4 },
  priceActive: { borderWidth: 2, borderColor: color.mid, backgroundColor: color.tintSoft },
  priceLabel: { fontSize: 13, fontWeight: "700", color: color.muted, textAlign: "center" },
  priceSub: { fontSize: 10, color: color.muted, textAlign: "center" },
  priceCheck: { position: "absolute", top: 5, right: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: color.mid, alignItems: "center", justifyContent: "center" },
  timeBox: { marginTop: 12, paddingHorizontal: 13, paddingVertical: 2, borderRadius: 13, borderWidth: 1, borderColor: color.line, backgroundColor: color.page },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  timeLabel: { fontSize: 13, fontWeight: "700", color: color.label },
  timeDay: { fontSize: 12, color: color.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: color.line },
  location: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: color.line, marginTop: 6 },
  locationIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: color.tint, alignItems: "center", justifyContent: "center" },
  locationName: { fontSize: 14, fontWeight: "700", color: color.text },
  locationAddress: { fontSize: 12, color: color.muted, marginTop: 2 },
  success: { alignItems: "center", paddingTop: 48, gap: 8 },
  successTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.6, color: color.text, marginTop: 22, textAlign: "center" },
  successText: { fontSize: 14, lineHeight: 21, color: color.muted, textAlign: "center", paddingHorizontal: 20 },
  summary: { marginTop: 22, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  summaryRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11 },
  summaryBorder: { borderBottomWidth: 1, borderBottomColor: color.softLine },
  summaryTitle: { fontSize: 14, fontWeight: "700", color: color.text },
  summarySub: { fontSize: 12, color: color.muted, marginTop: 2 },
  published: { marginTop: 22, padding: 10, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  publishNote: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: color.amberSoft },
  publishNoteTitle: { fontSize: 14, fontWeight: "700", color: color.warnText },
  publishNoteSub: { fontSize: 12, color: color.muted, marginTop: 2 },
  successActions: { gap: 6, marginTop: 22 },
});
