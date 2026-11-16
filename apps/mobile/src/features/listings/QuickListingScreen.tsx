import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createListingSchema, type CategoryDto, type SellerBusinessDto, type SellerListingDto } from "@bitego/shared";
import { createListing, fetchCategories, fetchMyBusiness } from "@/api/seller";
import { toFieldErrors } from "@/features/auth/formErrors";
import { color, formatTime } from "./design";
import { Icon } from "./Icon";
import { apiFieldErrors, AppHeader, Badge, Btn, errorMessage, Field, FormError, LoadError, Note, Page, SkeletonCards } from "./kit";
import { CategoryChips, fieldForError, LocationCard, nextQuarterHour, PickupTimes, PriceSelector, pricesFor, PublishedView, toNumber, type PriceType } from "./formParts";

// "Quick listing" from the design: only the essentials, published straight away.
export function QuickListingScreen() {
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);
  const [shop, setShop] = useState<SellerBusinessDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("free");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [start, setStart] = useState(nextQuarterHour);
  const [end, setEnd] = useState(() => new Date(nextQuarterHour().getTime() + 3600000));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState<SellerListingDto | null>(null);

  async function load() {
    setLoadError(null);
    try {
      const [cats, business] = await Promise.all([fetchCategories(), fetchMyBusiness()]);
      setCategories(cats);
      setShop(business);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    setFormError(null);
    const parsed = createListingSchema.safeParse({
      categoryId: categoryId ?? undefined,
      title,
      quantityTotal: toNumber(quantity),
      unit: "PORTION",
      ...pricesFor(priceType, price, originalPrice),
      pickupStart: start.toISOString(),
      pickupEnd: end.toISOString(),
      audience: "EVERYONE",
    });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error.issues));
      setFormError("Please fix the highlighted fields.");
      return;
    }
    if (end.getTime() <= Date.now()) {
      setErrors({ pickupEnd: "The pickup end time has already passed" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      setPublished(await createListing(parsed.data));
    } catch (err) {
      const field = fieldForError(err);
      setErrors(field ? { [field]: errorMessage(err) } : apiFieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (published) {
    return (
      <PublishedView
        quick
        listing={published}
        title="Listing is live!"
        text={`${published.quantityTotal} portions of ${published.title} are now available nearby. Quantity and expiry update automatically.`}
      />
    );
  }

  const header = <AppHeader title="Quick listing" action={<Badge label="Under 1 min" tone="green" />} />;
  if (loadError) return <Page header={header}><LoadError message={loadError} onRetry={() => void load()} /></Page>;
  if (!categories) return <Page header={header}><SkeletonCards count={2} /></Page>;

  const qty = toNumber(quantity);
  return (
    <Page
      header={header}
      footer={
        <>
          <FormError>{formError}</FormError>
          <Btn title="Publish listing" icon="sparkles" loading={saving} onPress={() => void submit()} />
        </>
      }
    >
      <View style={styles.intro}>
        <View style={styles.introIcon}><Icon name="sparkles" color={color.primary} /></View>
        <View style={styles.flex}>
          <Text style={styles.introTitle}>Last-minute surplus?</Text>
          <Text style={styles.introText}>Add only what customers need to reserve and collect.</Text>
        </View>
      </View>

      <View style={styles.form}>
        <Step n={1} title="Add food" sub="What is available?" first>
          <Field label="Food name" placeholder="Rice & Curry" value={title} onChangeText={setTitle} error={errors.title} />
          <CategoryChips categories={categories} audience="EVERYONE" value={categoryId} onChange={setCategoryId} error={errors.categoryId} />
        </Step>

        <Step n={2} title="Set quantity" sub="We'll reduce it automatically with reservations">
          <Field label="Total portions" placeholder="10" keyboardType="number-pad" value={quantity} onChangeText={setQuantity} error={errors.quantityTotal} />
          <View style={styles.demo}>
            <Badge label="Available" tone="green" />
            <Text style={styles.demoText}>
              {qty && qty > 0 ? `${qty} portions` : "Your portions"} → automatically becomes <Text style={styles.demoBold}>Limited</Text> at 3 → <Text style={styles.demoBold}>Sold out</Text> at 0
            </Text>
          </View>
        </Step>

        <Step n={3} title="Set price" sub="Surplus food does not have to be sold">
          <PriceSelector value={priceType} onChange={setPriceType} />
          {priceType === "free" ? (
            <Note icon="leaf" title="Free listing" text="Customers reserve for free. Your quantity still applies." />
          ) : (
            <View style={styles.twoFields}>
              {priceType === "discounted" ? (
                <Field style={styles.flex} label="Original price" prefix="Rs." placeholder="250" keyboardType="decimal-pad" value={originalPrice} onChangeText={setOriginalPrice} error={errors.originalPrice} />
              ) : null}
              <Field
                style={styles.flex}
                label={priceType === "discounted" ? "Discounted price" : "Customer price"}
                prefix="Rs."
                placeholder="150"
                keyboardType="decimal-pad"
                value={price}
                onChangeText={setPrice}
                error={errors.price}
              />
            </View>
          )}
        </Step>

        <Step n={4} title="Set pickup time" sub="Publish now, even when closing soon">
          <PickupTimes start={start} end={end} setStart={setStart} setEnd={setEnd} />
          {errors.pickupEnd ? <Text style={styles.errorNote}>{errors.pickupEnd}</Text> : null}
          <Note icon="clock" tone="amber" text={`Automatically changes to Expired at ${formatTime(end)}, when availability ends.`} />
        </Step>

        <Step n={5} title="Pickup location" sub="Where customers collect">
          <LocationCard shop={shop} />
        </Step>
      </View>
    </Page>
  );
}

function Step({ n, title, sub, first, children }: { n: number; title: string; sub: string; first?: boolean; children: ReactNode }) {
  return (
    <View style={[styles.step, !first && styles.stepBorder]}>
      <View style={styles.stepHead}>
        <View style={styles.stepNo}><Text style={styles.stepNoText}>{n}</Text></View>
        <View style={styles.flex}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepSub}>{sub}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 15, backgroundColor: color.tintSoft, marginBottom: 12 },
  introIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: color.tint, alignItems: "center", justifyContent: "center" },
  introTitle: { fontSize: 14, fontWeight: "700", color: color.primary },
  introText: { fontSize: 12, color: color.muted, marginTop: 3 },
  form: { padding: 16, borderRadius: 19, borderWidth: 1, borderColor: color.softLine, backgroundColor: color.surface },
  step: { paddingBottom: 4 },
  stepBorder: { marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: color.softLine },
  stepHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepNo: { width: 28, height: 28, borderRadius: 9, backgroundColor: color.primary, alignItems: "center", justifyContent: "center" },
  stepNoText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  stepTitle: { fontSize: 15, fontWeight: "700", color: color.text },
  stepSub: { fontSize: 12, color: color.muted, marginTop: 1 },
  demo: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 11, backgroundColor: color.page, marginTop: 12 },
  demoText: { flex: 1, fontSize: 12, lineHeight: 17, color: color.muted },
  demoBold: { fontWeight: "700", color: color.warnText },
  twoFields: { flexDirection: "row", gap: 10 },
  errorNote: { fontSize: 12, color: color.error, marginTop: 8, fontWeight: "500" },
});
