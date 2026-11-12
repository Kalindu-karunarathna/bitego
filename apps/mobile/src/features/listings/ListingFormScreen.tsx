import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import {
  createListingSchema,
  QUANTITY_UNITS,
  type CategoryDto,
  type CreateListingInput,
  type ListingAudience,
  type QuantityUnit,
  type SellerBusinessDto,
  type SellerListingDto,
  type UpdateListingInput,
} from "@bitego/shared";
import {
  addListingImage,
  createListing,
  fetchCategories,
  fetchMyBusiness,
  fetchMyListing,
  removeListingImage,
  updateListing,
  uploadListingPhoto,
} from "@/api/seller";
import { toFieldErrors } from "@/features/auth/formErrors";
import { color, formatDay, formatMoney, formatPrice, formatQuantity, formatTime, savePercent } from "./design";
import { Icon } from "./Icon";
import { apiFieldErrors, AppHeader, Badge, Btn, Chips, errorMessage, Field, FormBlock, FormError, LoadError, Note, Page, SkeletonCards, FoodImage } from "./kit";
import { PhotoPicker, type PhotoItem } from "./PhotoPicker";
import {
  AUDIENCES,
  CategoryChips,
  fieldForError,
  LocationCard,
  nextQuarterHour,
  PickupTimes,
  PriceSelector,
  priceTypeOf,
  pricesFor,
  PublishedView,
  toNumber,
  type PriceType,
} from "./formParts";

const UNIT_LABELS: Record<QuantityUnit, string> = { PORTION: "Portions", PIECE: "Pieces", PACK: "Packs", KG: "Kg" };

// The detailed listing form (design: "Create surplus listing"), then a customer preview, then "Listing published!".
// With a listing id it edits instead; photos then save immediately.
export function ListingFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);
  const [shop, setShop] = useState<SellerBusinessDto | null>(null);
  const [existing, setExisting] = useState<SellerListingDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<QuantityUnit>("PORTION");
  const [priceType, setPriceType] = useState<PriceType>("discounted");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [start, setStart] = useState(nextQuarterHour);
  const [end, setEnd] = useState(() => new Date(nextQuarterHour().getTime() + 2 * 3600000));
  const [pickupNote, setPickupNote] = useState("");
  const [audience, setAudience] = useState<ListingAudience>("EVERYONE");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<CreateListingInput | null>(null);
  const [published, setPublished] = useState<SellerListingDto | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [cats, business, listing] = await Promise.all([fetchCategories(), fetchMyBusiness(), id ? fetchMyListing(id) : Promise.resolve(null)]);
      setCategories(cats);
      setShop(business);
      if (listing) {
        setExisting(listing);
        setTitle(listing.title);
        setDescription(listing.description ?? "");
        setCategoryId(listing.category.id);
        setQuantity(String(listing.quantityTotal));
        setUnit(listing.unit);
        const type = priceTypeOf(listing);
        setPriceType(type);
        setPrice(type === "free" ? "" : String(listing.price));
        setOriginalPrice(type === "discounted" ? String(listing.originalPrice) : "");
        setStart(new Date(listing.pickupStart));
        setEnd(new Date(listing.pickupEnd));
        setPickupNote(listing.pickupNote ?? "");
        setAudience(listing.audience);
        setPhotos(listing.images.map((i) => ({ id: i.id, uri: i.imageUrl })));
      }
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function chooseAudience(next: ListingAudience) {
    setAudience(next);
    const selected = categories?.find((c) => c.id === categoryId);
    if (next === "BUSINESSES_ONLY" && selected && selected.b2bSuitability !== "SUITABLE") setCategoryId(null);
  }

  // Photos: while creating, upload and keep the keys for the POST. While editing, save straight away.
  const addPhoto = async (asset: ImagePickerAsset) => {
    const key = await uploadListingPhoto({ uri: asset.uri, mimeType: asset.mimeType });
    if (existing) {
      const updated = await addListingImage(existing.id, key);
      setExisting(updated);
      setPhotos(updated.images.map((i) => ({ id: i.id, uri: i.imageUrl })));
    } else {
      setPhotos((current) => [...current, { id: key, uri: asset.uri }]);
    }
  };

  const removePhoto = async (photo: PhotoItem) => {
    if (existing) {
      const updated = await removeListingImage(existing.id, photo.id);
      setExisting(updated);
      setPhotos(updated.images.map((i) => ({ id: i.id, uri: i.imageUrl })));
    } else {
      setPhotos((current) => current.filter((p) => p.id !== photo.id));
    }
  };

  function validate(): CreateListingInput | null {
    setFormError(null);
    const parsed = createListingSchema.safeParse({
      categoryId: categoryId ?? undefined,
      title,
      description: description.trim() || undefined,
      quantityTotal: toNumber(quantity),
      unit,
      ...pricesFor(priceType, price, originalPrice),
      pickupStart: start.toISOString(),
      pickupEnd: end.toISOString(),
      pickupNote: pickupNote.trim() || undefined,
      audience,
      imageKeys: existing ? undefined : photos.map((p) => p.id),
    });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error.issues));
      setFormError("Please fix the highlighted fields.");
      return null;
    }
    const pickupChanged = !existing || existing.pickupEnd !== end.toISOString();
    if (pickupChanged && end.getTime() <= Date.now()) {
      setErrors({ pickupEnd: "The pickup end time has already passed" });
      setFormError("Please fix the highlighted fields.");
      return null;
    }
    setErrors({});
    return parsed.data;
  }

  function handleError(err: unknown) {
    const field = fieldForError(err);
    setErrors(field ? { [field]: errorMessage(err) } : apiFieldErrors(err));
    setFormError(errorMessage(err));
  }

  async function saveEdit() {
    const input = validate();
    if (!input || !existing) return;
    setSaving(true);
    try {
      await updateListing(existing.id, changesFrom(existing, input));
      router.back();
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!preview) return;
    setSaving(true);
    try {
      setPublished(await createListing(preview));
    } catch (err) {
      setPreview(null);
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  const screenTitle = id ? "Edit listing" : "Create surplus listing";

  if (published) {
    return <PublishedView listing={published} title="Listing published!" text={`Your ${published.title} listing is now visible to nearby BiteGo buyers.`} />;
  }

  if (preview) {
    return (
      <PreviewView
        input={preview}
        shop={shop}
        photo={photos[0]?.uri}
        categoryName={categories?.find((c) => c.id === preview.categoryId)?.name ?? ""}
        saving={saving}
        onEdit={() => setPreview(null)}
        onPublish={() => void publish()}
      />
    );
  }

  if (loadError) {
    return (
      <Page header={<AppHeader title={screenTitle} />}>
        <LoadError message={loadError} onRetry={() => void load()} />
      </Page>
    );
  }
  if (!categories || (id && !existing)) {
    return (
      <Page header={<AppHeader title={screenTitle} />}>
        <SkeletonCards />
      </Page>
    );
  }

  const { price: customerPrice, originalPrice: original } = pricesFor(priceType, price, originalPrice);
  const saving_ = (original ?? 0) - (customerPrice ?? 0);

  return (
    <Page
      header={<AppHeader title={screenTitle} />}
      footer={
        <>
          <FormError>{formError}</FormError>
          {existing ? (
            <Btn title="Save changes" icon="check" loading={saving} onPress={() => void saveEdit()} />
          ) : (
            <Btn title="Preview listing" icon="eye" onPress={() => { const input = validate(); if (input) setPreview(input); }} />
          )}
        </>
      }
    >
      <FormBlock icon="food" title="Food information" subtitle="Tell customers what is available">
        <Field label="Food name" placeholder="e.g. Rice & Curry" value={title} onChangeText={setTitle} error={errors.title} />
        <CategoryChips categories={categories} existing={existing} audience={audience} value={categoryId} onChange={setCategoryId} error={errors.categoryId} />
        <Field label="Description" optional multiline placeholder="Describe the food, ingredients and anything customers should know..." value={description} onChangeText={setDescription} error={errors.description} />
        <PhotoPicker photos={photos} onAdd={addPhoto} onRemove={removePhoto} />
      </FormBlock>

      <FormBlock icon="box" title="Quantity" subtitle="Set today's available portions">
        <Field label="Total portions/items" placeholder="14" keyboardType="number-pad" value={quantity} onChangeText={setQuantity} error={errors.quantityTotal} />
        {existing && existing.quantityTotal > existing.quantityAvailable ? (
          <Text style={styles.reservedNote}>{existing.quantityTotal - existing.quantityAvailable} already reserved, so the quantity cannot go below that.</Text>
        ) : null}
        <Chips label="Unit" options={QUANTITY_UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))} value={unit} onChange={setUnit} error={errors.unit} />
        <Note icon="sparkles" text="Available quantity decreases automatically with reservations and stops at sold out." />
      </FormBlock>

      <FormBlock icon="wallet" title="Pricing" subtitle="Free or paid — you decide">
        <PriceSelector value={priceType} onChange={setPriceType} />
        {priceType === "free" ? (
          <Note icon="leaf" title="Customers reserve this food for free" text="Your quantity still applies." />
        ) : (
          <>
            <View style={styles.twoFields}>
              {priceType === "discounted" ? (
                <Field style={styles.half} label="Original price" prefix="Rs." placeholder="250" keyboardType="decimal-pad" value={originalPrice} onChangeText={setOriginalPrice} error={errors.originalPrice} />
              ) : null}
              <Field style={styles.half} label="Customer price" prefix="Rs." placeholder="150" keyboardType="decimal-pad" value={price} onChangeText={setPrice} error={errors.price} />
            </View>
            {priceType === "discounted" && saving_ > 0 && original ? (
              <View style={styles.savings}>
                <View style={styles.savingsIcon}><Icon name="trend" size={18} color={color.primary} /></View>
                <View style={styles.flex}>
                  <Text style={styles.savingsTitle}>Customer saves {formatMoney(saving_)}</Text>
                  <Text style={styles.savingsSub}>{savePercent(original, customerPrice ?? 0)}% less than original price</Text>
                </View>
              </View>
            ) : null}
          </>
        )}
      </FormBlock>

      <FormBlock icon="clock" title="Availability" subtitle="Choose a realistic pickup window">
        <PickupTimes start={start} end={end} setStart={setStart} setEnd={setEnd} />
        {errors.pickupStart ? <Text style={styles.errorNote}>{errors.pickupStart}</Text> : null}
        {errors.pickupEnd ? <Text style={styles.errorNote}>{errors.pickupEnd}</Text> : null}
        <Note icon="alert" tone="amber" text={`The listing expires automatically at ${formatTime(end)} when pickup time ends.`} />
      </FormBlock>

      <FormBlock icon="users" title="Who can reserve" subtitle="Customers, businesses or both">
        <Chips options={AUDIENCES.map(({ value, label }) => ({ value, label }))} value={audience} onChange={chooseAudience} error={errors.audience} />
        <Note icon="info" text={AUDIENCES.find((a) => a.value === audience)?.hint ?? ""} />
      </FormBlock>

      <FormBlock icon="pin" title="Pickup location" subtitle="Customers will collect here">
        <LocationCard shop={shop} />
        <Field label="Pickup note" optional placeholder="e.g. Collect at the main counter" value={pickupNote} onChangeText={setPickupNote} error={errors.pickupNote} />
      </FormBlock>
    </Page>
  );
}

// What customers will see, before publishing.
function PreviewView({
  input,
  shop,
  photo,
  categoryName,
  saving,
  onEdit,
  onPublish,
}: {
  input: CreateListingInput;
  shop: SellerBusinessDto | null;
  photo?: string;
  categoryName: string;
  saving: boolean;
  onEdit: () => void;
  onPublish: () => void;
}) {
  const save = input.originalPrice - input.price;
  const end = new Date(input.pickupEnd);
  return (
    <Page
      header={<AppHeader title="Preview listing" onBack={onEdit} />}
      footer={
        <View style={styles.footerRow}>
          <Btn title="Edit" icon="edit" variant="secondary" onPress={onEdit} disabled={saving} style={styles.footerNarrow} />
          <Btn title="Publish listing" icon="sparkles" onPress={onPublish} loading={saving} style={styles.flex} />
        </View>
      }
    >
      <View style={styles.previewNote}>
        <Icon name="eye" size={18} color={color.primary} />
        <Text style={styles.previewNoteText}>This is what customers will see.</Text>
      </View>
      <View style={styles.preview}>
        <View style={styles.previewImageWrap}>
          <FoodImage uri={photo} style={styles.previewImage} />
          <Badge label={`${formatQuantity(input.quantityTotal, input.unit)} left`} tone="orange" upper={false} style={styles.previewLeft} />
          <Text style={styles.pickupOnly}>PICKUP ONLY</Text>
        </View>
        <View style={styles.previewBody}>
          <View style={styles.providerRow}>
            <Text style={styles.provider}>{shop?.name ?? "Your shop"}</Text>
            <Icon name="shield" size={14} color={color.primary} />
          </View>
          <Text style={styles.previewName}>{input.title}</Text>
          <View style={styles.pricing}>
            <Text style={styles.previewPrice}>{formatPrice(input.price)}</Text>
            {save > 0 ? (
              <>
                <Text style={styles.oldPrice}>{formatMoney(input.originalPrice)}</Text>
                <Text style={styles.saveTag}>Save {formatMoney(save)}</Text>
              </>
            ) : null}
          </View>
          <View style={styles.details}>
            <View style={[styles.detail, styles.detailWide]}>
              <Icon name="clock" size={20} color={color.amber} />
              <View>
                <Text style={styles.detailSmall}>Pickup before</Text>
                <Text style={styles.detailBold}>{formatDay(end)}, {formatTime(end)}</Text>
              </View>
            </View>
            <View style={styles.detail}>
              <Icon name="pin" size={20} color={color.amber} />
              <View style={styles.flex}>
                <Text style={styles.detailSmall}>Pickup at</Text>
                <Text style={styles.detailBold} numberOfLines={1}>{shop?.city ?? "—"}</Text>
              </View>
            </View>
          </View>
          {categoryName ? <Text style={styles.category}>{categoryName}</Text> : null}
          {input.description ? <Text style={styles.description}>{input.description}</Text> : null}
        </View>
      </View>
      <View style={styles.ready}>
        <Icon name="check" color={color.primary} />
        <View style={styles.flex}>
          <Text style={styles.readyTitle}>Ready to publish</Text>
          <Text style={styles.readySub}>All required listing details are complete.</Text>
        </View>
      </View>
    </Page>
  );
}

// Only what changed goes to the API, so unchanged times are not re-checked against the pickup-window rules.
function changesFrom(existing: SellerListingDto, next: CreateListingInput): UpdateListingInput {
  const changes: UpdateListingInput = {};
  if (next.categoryId !== existing.category.id) changes.categoryId = next.categoryId;
  if (next.title !== existing.title) changes.title = next.title;
  if ((next.description ?? null) !== existing.description) changes.description = next.description ?? null;
  if (next.quantityTotal !== existing.quantityTotal) changes.quantityTotal = next.quantityTotal;
  if (next.unit !== existing.unit) changes.unit = next.unit;
  if (next.originalPrice !== existing.originalPrice) changes.originalPrice = next.originalPrice;
  if (next.price !== existing.price) changes.price = next.price;
  if (next.pickupStart !== existing.pickupStart) changes.pickupStart = next.pickupStart;
  if (next.pickupEnd !== existing.pickupEnd) changes.pickupEnd = next.pickupEnd;
  if ((next.pickupNote ?? null) !== existing.pickupNote) changes.pickupNote = next.pickupNote ?? null;
  if (next.audience !== existing.audience) changes.audience = next.audience;
  // An unchanged form still needs one field, because the API refuses an empty update.
  return Object.keys(changes).length > 0 ? changes : { title: next.title };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  reservedNote: { fontSize: 12, color: color.warnText, marginTop: 6 },
  errorNote: { fontSize: 12, color: color.error, marginTop: 8, fontWeight: "500" },
  twoFields: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  savings: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginTop: 12, borderRadius: 13, borderWidth: 1, borderColor: color.tintBorder, backgroundColor: color.tintSoft },
  savingsIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: color.tint, alignItems: "center", justifyContent: "center" },
  savingsTitle: { fontSize: 14, fontWeight: "700", color: color.primary },
  savingsSub: { fontSize: 12, color: color.primary, marginTop: 2 },
  footerRow: { flexDirection: "row", gap: 8 },
  footerNarrow: { flex: 0.7 },
  previewNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, padding: 11, borderRadius: 12, backgroundColor: color.tintSoft, marginBottom: 14 },
  previewNoteText: { fontSize: 13, color: color.primary },
  preview: { borderRadius: 21, overflow: "hidden", backgroundColor: color.surface, borderWidth: 1, borderColor: color.softLine },
  previewImageWrap: { height: 240 },
  previewImage: { width: "100%", height: "100%", borderRadius: 0 },
  previewLeft: { position: "absolute", left: 13, bottom: 13 },
  pickupOnly: { position: "absolute", right: 13, bottom: 13, backgroundColor: color.primary, color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.6, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, overflow: "hidden" },
  previewBody: { padding: 17 },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  provider: { fontSize: 13, fontWeight: "700", color: color.primary },
  previewName: { fontSize: 24, fontWeight: "800", color: color.text, marginTop: 5, marginBottom: 9 },
  pricing: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewPrice: { fontSize: 22, fontWeight: "800", color: color.primary },
  oldPrice: { fontSize: 13, color: "#9CA3AF", textDecorationLine: "line-through" },
  saveTag: { fontSize: 11, fontWeight: "700", color: color.primary, backgroundColor: color.tint, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, overflow: "hidden" },
  details: { flexDirection: "row", gap: 8, marginVertical: 15 },
  detail: { flex: 0.8, flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, backgroundColor: color.page },
  detailWide: { flex: 1.3 },
  detailSmall: { fontSize: 11, color: color.muted },
  detailBold: { fontSize: 12, fontWeight: "700", color: color.text },
  category: { fontSize: 12, fontWeight: "600", color: color.muted, marginBottom: 6 },
  description: { fontSize: 13, lineHeight: 20, color: color.muted },
  ready: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: color.tintBorder, backgroundColor: color.tintSoft },
  readyTitle: { fontSize: 14, fontWeight: "700", color: color.primary },
  readySub: { fontSize: 12, color: color.muted, marginTop: 2 },
});
