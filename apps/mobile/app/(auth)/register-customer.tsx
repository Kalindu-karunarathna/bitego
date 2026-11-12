import { registerSchema } from "@bitego/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ApiRequestError } from "@/api/client";
import { Banner, Button, Screen, TextField, Title } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { toFieldErrors } from "@/features/auth/formErrors";

export default function RegisterCustomer() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setFormError(null);
    const parsed = registerSchema.safeParse({
      role: "CUSTOMER",
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      phone: form.phone.trim() || undefined,
    });
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error.issues));
    setErrors({});
    setBusy(true);
    try {
      await register(parsed.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.details) setErrors(toFieldErrors(e.details as never));
      setFormError(e instanceof Error ? e.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Customer account</Title>
      <TextField label="Full name" value={form.fullName} onChangeText={set("fullName")} error={errors.fullName} autoCapitalize="words" />
      <TextField label="Email" value={form.email} onChangeText={set("email")} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
      <TextField label="Phone" optional value={form.phone} onChangeText={set("phone")} error={errors.phone} keyboardType="phone-pad" placeholder="0771234567" />
      <TextField label="Password" value={form.password} onChangeText={set("password")} error={errors.password} secure autoCapitalize="none" />
      {formError ? <Banner tone="error">{formError}</Banner> : null}
      <Button title="Create account" onPress={submit} loading={busy} />
      <Button title="Back" variant="link" onPress={() => router.back()} />
    </Screen>
  );
}
