import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { BUSINESS_TYPES, updateBusinessSchema, type BusinessType, type SellerBusinessDto, type UpdateBusinessInput } from "@bitego/shared";
import { fetchMyBusiness, updateMyBusiness } from "@/api/seller";
import { LocationPicker, type Coordinates } from "@/components/LocationPicker";
import { useAuth } from "@/features/auth/AuthProvider";
import { toFieldErrors } from "@/features/auth/formErrors";
import { color } from "@/features/listings/design";
import { apiFieldErrors, AppHeader, Btn, Chips, errorMessage, Field, FieldError, FormBlock, FormError, LoadError, Note, Page, SkeletonCards } from "@/features/listings/kit";
import { BUSINESS_TYPE_LABELS } from "./ShopScreen";

// "Business Profile" (mode profile) and "Shop Location" (mode location) from the design's Account screen.
export function EditShopScreen({ mode = "profile" }: { mode?: "profile" | "location" }) {
  const router = useRouter();
  const { reload } = useAuth();
  const [shop, setShop] = useState<SellerBusinessDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<BusinessType | null>(null);
  const [description, setDescription] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [email, setEmail] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [location, setLocation] = useState<Coordinates | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const title = mode === "profile" ? "Business Profile" : "Shop Location";

  async function load() {
    setLoadError(null);
    try {
      const b = await fetchMyBusiness();
      setShop(b);
      setName(b.name);
      setType(b.type);
      setDescription(b.description ?? "");
      setContactNo(b.contactNo);
      setEmail(b.email ?? "");
      setAddressLine(b.addressLine);
      setCity(b.city);
      setDistrict(b.district ?? "");
      setLocation({ latitude: b.latitude, longitude: b.longitude });
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setFormError(null);
    const input: UpdateBusinessInput =
      mode === "profile"
        ? { name, type: type ?? undefined, description: description.trim() || null, contactNo, email: email.trim() || null }
        : { addressLine, city, district: district.trim() || null, latitude: location?.latitude, longitude: location?.longitude };
    const parsed = updateBusinessSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error.issues));
      setFormError("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await updateMyBusiness(parsed.data);
      await reload(); // The shop name appears on other screens.
      router.back();
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const header = <AppHeader title={title} />;
  if (loadError) return <Page header={header}><LoadError message={loadError} onRetry={() => void load()} /></Page>;
  if (!shop) return <Page header={header}><SkeletonCards count={2} /></Page>;

  return (
    <Page
      header={header}
      footer={
        <>
          <FormError>{formError}</FormError>
          <Btn title={mode === "profile" ? "Save changes" : "Save location"} icon="check" loading={saving} onPress={() => void save()} />
        </>
      }
    >
      {mode === "profile" ? (
        <FormBlock icon="store" title="Business details" subtitle="Shown to buyers on your listings">
          <Field label="Business name" value={name} onChangeText={setName} error={errors.name} placeholder="Business name" />
          <Chips label="Business type" options={BUSINESS_TYPES.map((t) => ({ value: t, label: BUSINESS_TYPE_LABELS[t] }))} value={type} onChange={setType} error={errors.type} />
          <Field label="Short description" optional multiline value={description} onChangeText={setDescription} error={errors.description} placeholder="Home-style meals near the university." />
          <Field label="Telephone number" icon="phone" keyboardType="phone-pad" value={contactNo} onChangeText={setContactNo} error={errors.contactNo} placeholder="0771234567" />
          <Field label="Business email" optional icon="mail" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} error={errors.email} placeholder="shop@example.com" />
          {shop.registrationNo ? (
            <Field label="Business registration no." value={shop.registrationNo} onChangeText={() => undefined} disabled />
          ) : null}
          {shop.registrationNo ? <Text style={styles.hint}>The registration number was checked by the admin and cannot be changed here.</Text> : null}
        </FormBlock>
      ) : (
        <>
          <FormBlock icon="pin" title="Address" subtitle="Where customers collect their food">
            <Field label="Street address" icon="pin" value={addressLine} onChangeText={setAddressLine} error={errors.addressLine} placeholder="24 Temple Road" />
            <Field label="City" autoCapitalize="words" value={city} onChangeText={setCity} error={errors.city} placeholder="Peradeniya" />
            <Field label="District" optional autoCapitalize="words" value={district} onChangeText={setDistrict} error={errors.district} placeholder="Kandy" />
          </FormBlock>
          <FormBlock icon="pin" title="Map pin" subtitle="Used to show buyers how far away you are">
            <LocationPicker value={location} onChange={setLocation} error={errors.latitude} />
            <FieldError>{errors.longitude}</FieldError>
            <Note icon="info" text="Stand at your shop and tap 'Use my current location', or drag the pin to the right spot." />
          </FormBlock>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: color.muted, marginTop: 6 },
});
