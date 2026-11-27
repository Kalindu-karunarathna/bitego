import { BUSINESS_TYPES, registerSchema, type BusinessType } from "@bitego/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ApiRequestError } from "@/api/client";
import { Banner, Body, Button, ChoiceChips, Heading, Screen, TextField, Title } from "@/components/ui";
import { LocationPicker, type Coordinates } from "@/components/LocationPicker";
import { useAuth } from "@/features/auth/AuthProvider";
import { toFieldErrors } from "@/features/auth/formErrors";

const TYPE_LABEL: Record<BusinessType, string> = {
  RESTAURANT: "Restaurant",
  CAFE: "Cafe",
  BAKERY: "Bakery",
  SUPERMARKET: "Supermarket",
  CANTEEN: "Canteen",
  HOTEL: "Hotel",
  SHOP: "Shop",
  OTHER: "Other",
};

export default function RegisterBusiness() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", password: "",
    name: "", registrationNo: "", description: "", contactNo: "", addressLine: "", city: "", district: "",
  });
  const [type, setType] = useState<BusinessType | null>(null);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const opt = (v: string) => v.trim() || undefined;

  async function submit() {
    setFormError(null);
    const parsed = registerSchema.safeParse({
      role: "BUSINESS",
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      phone: opt(form.phone),
      business: {
        name: form.name,
        type: type ?? undefined,
        registrationNo: opt(form.registrationNo),
        description: opt(form.description),
        contactNo: form.contactNo,
        addressLine: form.addressLine,
        city: form.city,
        district: opt(form.district),
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      },
    });
    if (!parsed.success) {
      const e = toFieldErrors(parsed.error.issues);
      if (e["business.latitude"] || e["business.longitude"]) e.location = "Set your shop location";
      if (e["business.type"]) e["business.type"] = "Choose a business type";
      setErrors(e);
      return setFormError("Please fix the highlighted fields.");
    }
    setErrors({});
    setBusy(true);
    try {
      await register(parsed.data);
    } catch (e) {
      if (e instanceof ApiRequestError && Array.isArray(e.details)) setErrors(toFieldErrors(e.details as never));
      setFormError(e instanceof Error ? e.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Business account</Title>
      <Body muted>An admin reviews every business before it can post food.</Body>

      <Heading>Your details</Heading>
      <TextField label="Your full name" value={form.fullName} onChangeText={set("fullName")} error={errors.fullName} autoCapitalize="words" />
      <TextField label="Email" value={form.email} onChangeText={set("email")} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
      <TextField label="Your phone" optional value={form.phone} onChangeText={set("phone")} error={errors.phone} keyboardType="phone-pad" />
      <TextField label="Password" value={form.password} onChangeText={set("password")} error={errors.password} secure autoCapitalize="none" />

      <Heading>Your business</Heading>
      <TextField label="Business name" value={form.name} onChangeText={set("name")} error={errors["business.name"]} autoCapitalize="words" />
      <ChoiceChips
        label="Type"
        options={BUSINESS_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
        value={type}
        onChange={setType}
        error={errors["business.type"]}
      />
      <TextField label="Business phone" value={form.contactNo} onChangeText={set("contactNo")} error={errors["business.contactNo"]} keyboardType="phone-pad" placeholder="0112345678" />
      <TextField label="Registration number" optional value={form.registrationNo} onChangeText={set("registrationNo")} error={errors["business.registrationNo"]} />
      <TextField label="Description" optional multiline value={form.description} onChangeText={set("description")} error={errors["business.description"]} />

      <Heading>Shop location</Heading>
      <TextField label="Address" value={form.addressLine} onChangeText={set("addressLine")} error={errors["business.addressLine"]} />
      <TextField label="City" value={form.city} onChangeText={set("city")} error={errors["business.city"]} autoCapitalize="words" />
      <TextField label="District" optional value={form.district} onChangeText={set("district")} error={errors["business.district"]} autoCapitalize="words" />
      <LocationPicker value={coords} onChange={setCoords} error={errors.location} />

      {formError ? <Banner tone="error">{formError}</Banner> : null}
      <Button title="Submit for approval" onPress={submit} loading={busy} />
      <Button title="Back" variant="link" onPress={() => router.back()} />
    </Screen>
  );
}
