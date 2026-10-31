#!/usr/bin/env bash
# Run from the REPO ROOT. Adds the mobile foundation: Expo Router screens with role-based guards,
# API client, Supabase login with secure session storage, login/register (customer + business with GPS/map pin),
# pending-approval screen, shared API types, and docs/architecture/mobile.md.
# Afterwards install the packages (see the instructions), then run the app.
set -e
[ -f package.json ] && [ -d apps/mobile ] && [ -d apps/web ] && [ -d packages/shared ] || { echo "Run this from the repo root"; exit 1; }

write() { # write <path>  (content on stdin). Existing files are kept unless FORCE=1.
  mkdir -p "$(dirname "$1")"
  if [ -e "$1" ] && [ -z "$FORCE" ]; then echo "SKIP  $1 already exists (FORCE=1 to overwrite)"; cat >/dev/null
  else cat > "$1"; echo "wrote $1"; fi
}

FORCE=1 write packages/shared/src/api-types.ts <<'BITEGO_EOF'
import type { BusinessStatus, BusinessType, Role } from "./constants";

// Shapes of API responses, shared so the mobile app and the API agree.
// Dates arrive as ISO strings because they travel as JSON.

export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

// GET /api/v1/auth/me
export type MeResponse = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  profilePictureUrl: string | null;
  business: {
    id: string;
    name: string;
    type: BusinessType;
    status: BusinessStatus;
    verification: { status: VerificationStatus; remarks: string | null; reviewedAt: string | null } | null;
  } | null;
};

// POST /api/v1/auth/register
export type RegisterResponse = {
  user: { id: string; email: string; fullName: string; role: Role; status: string };
  business: { id: string; name: string; status: BusinessStatus } | null;
};

// Every API error has this shape.
export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};
BITEGO_EOF

FORCE=1 write packages/shared/src/auth.ts <<'BITEGO_EOF'
import { z } from "zod";
import { BUSINESS_TYPES } from "./constants";

// Validation for POST /api/v1/auth/register.
// The mobile registration forms and the API use the same schema.
// "role" can only be CUSTOMER or BUSINESS. ADMIN accounts are never self-registered.

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
const phone = z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");
const fullName = z.string().trim().min(2, "Enter your full name").max(100);

const businessDetails = z.object({
  name: z.string().trim().min(2, "Enter the business name").max(120),
  type: z.enum(BUSINESS_TYPES, { error: "Choose a business type" }),
  registrationNo: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(500).optional(),
  contactNo: phone,
  email: email.optional(),
  addressLine: z.string().trim().min(3, "Enter the shop address").max(200),
  city: z.string().trim().min(2, "Enter the city").max(80),
  district: z.string().trim().min(2).max(80).optional(),
  // Shop location: from the phone's GPS button and the map pin.
  latitude: z.number({ error: "Set your shop location" }).min(-90).max(90),
  longitude: z.number({ error: "Set your shop location" }).min(-180).max(180),
  // Business registration document (uploaded first, then its URL is sent here).
  documentUrl: z.url().optional(),
});

export const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("CUSTOMER"),
    email,
    password,
    fullName,
    phone: phone.optional(),
  }),
  z.object({
    role: z.literal("BUSINESS"),
    email,
    password,
    fullName,
    phone: phone.optional(),
    business: businessDetails,
  }),
]);

export type RegisterInput = z.infer<typeof registerSchema>;
BITEGO_EOF

FORCE=1 write packages/shared/src/index.ts <<'BITEGO_EOF'
export * from "./constants";
export * from "./auth";
export * from "./api-types";
BITEGO_EOF

write "apps/mobile/app/(auth)/_layout.tsx" <<'BITEGO_EOF'
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
BITEGO_EOF

write "apps/mobile/app/(auth)/login.tsx" <<'BITEGO_EOF'
import { Link } from "expo-router";
import { useState } from "react";
import { Banner, Body, Button, ErrorText, Screen, TextField, Title } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

export default function Login() {
  const { signIn, notice } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return setError("Enter your email and password");
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password); // the root layout moves us to the right screen
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen centered>
      <Title>BiteGo</Title>
      <Body muted>Rescue surplus food near you.</Body>
      {notice ? <Banner tone="warning">{notice}</Banner> : null}
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextField label="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" />
      <ErrorText>{error}</ErrorText>
      <Button title="Log in" onPress={submit} loading={busy} />
      <Link href="/register" asChild>
        <Button title="Create an account" variant="link" onPress={() => {}} />
      </Link>
    </Screen>
  );
}
BITEGO_EOF

write "apps/mobile/app/(auth)/register-business.tsx" <<'BITEGO_EOF'
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
BITEGO_EOF

write "apps/mobile/app/(auth)/register-customer.tsx" <<'BITEGO_EOF'
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
BITEGO_EOF

write "apps/mobile/app/(auth)/register.tsx" <<'BITEGO_EOF'
import { useRouter } from "expo-router";
import { Body, Button, Card, Screen, Title } from "@/components/ui";

export default function ChooseAccountType() {
  const router = useRouter();
  return (
    <Screen centered>
      <Title>Create an account</Title>
      <Body muted>How will you use BiteGo?</Body>
      <Card onPress={() => router.push("/register-customer")}>
        <Body>I want to buy surplus food</Body>
        <Body muted>Customer account</Body>
      </Card>
      <Card onPress={() => router.push("/register-business")}>
        <Body>I want to sell surplus food</Body>
        <Body muted>Business account (restaurant, bakery, shop…). Needs admin approval.</Body>
      </Card>
      <Button title="Back to log in" variant="link" onPress={() => router.back()} />
    </Screen>
  );
}
BITEGO_EOF

write "apps/mobile/app/(business)/_layout.tsx" <<'BITEGO_EOF'
import { Tabs } from "expo-router";
import { theme } from "@/lib/theme";

// Approved business tabs.
export default function BusinessLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.primary }}>
      <Tabs.Screen name="sell" options={{ title: "My listings" }} />
      <Tabs.Screen name="buy" options={{ title: "Buy" }} />
      <Tabs.Screen name="orders" options={{ title: "Orders" }} />
      <Tabs.Screen name="shop" options={{ title: "Shop" }} />
    </Tabs>
  );
}
BITEGO_EOF

write "apps/mobile/app/(business)/buy.tsx" <<'BITEGO_EOF'
import { Placeholder } from "@/components/Placeholder";

export default function Buy() {
  return <Placeholder title="Buy surplus" owner="Nistha" description="Listings from other businesses meant for business buyers." />;
}
BITEGO_EOF

write "apps/mobile/app/(business)/orders.tsx" <<'BITEGO_EOF'
import { Placeholder } from "@/components/Placeholder";

export default function Orders() {
  return <Placeholder title="Orders" owner="Kajanika" description="Reservations on your listings. Confirm pickups with the customer's code." />;
}
BITEGO_EOF

write "apps/mobile/app/(business)/sell.tsx" <<'BITEGO_EOF'
import { Placeholder } from "@/components/Placeholder";

export default function Sell() {
  return <Placeholder title="My listings" owner="Kajanika" description="Post and manage your surplus food listings." />;
}
BITEGO_EOF

write "apps/mobile/app/(business)/shop.tsx" <<'BITEGO_EOF'
import { ProfileView } from "@/features/profile/ProfileView";

export default function Shop() {
  return <ProfileView />;
}
BITEGO_EOF

write "apps/mobile/app/(customer)/_layout.tsx" <<'BITEGO_EOF'
import { Tabs } from "expo-router";
import { theme } from "@/lib/theme";

// Customer tabs. Add a tab by adding a file in this folder and a <Tabs.Screen> line.
export default function CustomerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.primary }}>
      <Tabs.Screen name="discover" options={{ title: "Discover" }} />
      <Tabs.Screen name="reservations" options={{ title: "My reservations" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}
BITEGO_EOF

write "apps/mobile/app/(customer)/account.tsx" <<'BITEGO_EOF'
import { ProfileView } from "@/features/profile/ProfileView";

export default function Account() {
  return <ProfileView />;
}
BITEGO_EOF

write "apps/mobile/app/(customer)/discover.tsx" <<'BITEGO_EOF'
import { Placeholder } from "@/components/Placeholder";

export default function Discover() {
  return <Placeholder title="Discover" owner="Nistha" description="Surplus food near you, with filters and distance." />;
}
BITEGO_EOF

write "apps/mobile/app/(customer)/reservations.tsx" <<'BITEGO_EOF'
import { Placeholder } from "@/components/Placeholder";

export default function Reservations() {
  return <Placeholder title="My reservations" owner="Nistha" description="Your reservations and pickup codes." />;
}
BITEGO_EOF

write apps/mobile/app/_layout.tsx <<'BITEGO_EOF'
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { configProblems } from "@/lib/env";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { Banner, Body, Button, Loading, Screen, Title } from "@/components/ui";

// Root layout: decides which group of screens a user may see.
//   signed out             -> (auth)
//   CUSTOMER               -> (customer)
//   BUSINESS + ACTIVE      -> (business)
//   BUSINESS + not ACTIVE  -> pending-approval
//   ADMIN                  -> admin-notice (admins use the web dashboard)
// Stack.Protected removes the other groups completely, so a user can never open a screen of another role.

function RootNavigator() {
  const { status, profile, errorMessage, reload, signOut } = useAuth();

  if (configProblems.length > 0) {
    return (
      <Screen centered>
        <Title>Setup needed</Title>
        {configProblems.map((p) => (
          <Banner key={p} tone="error">{p}</Banner>
        ))}
        <Body muted>Fix apps/mobile/.env, then restart with: npx expo start -c</Body>
      </Screen>
    );
  }

  if (status === "loading") return <Loading label="Loading…" />;

  if (status === "error") {
    return (
      <Screen centered>
        <Title>Can't reach BiteGo</Title>
        <Body muted>{errorMessage}</Body>
        <Button title="Try again" onPress={reload} />
        <Button title="Log out" variant="link" onPress={signOut} />
      </Screen>
    );
  }

  const signedIn = status === "signedIn" && !!profile;
  const role = profile?.role;
  const businessActive = profile?.business?.status === "ACTIVE";

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === "CUSTOMER"}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === "BUSINESS" && businessActive}>
        <Stack.Screen name="(business)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === "BUSINESS" && !businessActive}>
        <Stack.Screen name="pending-approval" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === "ADMIN"}>
        <Stack.Screen name="admin-notice" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
BITEGO_EOF

write apps/mobile/app/admin-notice.tsx <<'BITEGO_EOF'
import { Body, Button, Screen, Title } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

// Admins work in the web dashboard, not in the phone app.
export default function AdminNotice() {
  const { signOut } = useAuth();
  return (
    <Screen centered>
      <Title>Admin account</Title>
      <Body muted>Admins manage BiteGo from the web dashboard. Please use it instead of the phone app.</Body>
      <Button title="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
BITEGO_EOF

write apps/mobile/app/index.tsx <<'BITEGO_EOF'
import { Redirect } from "expo-router";
import { useAuth } from "@/features/auth/AuthProvider";

// "/" just forwards to the right place for whoever is signed in.
export default function Index() {
  const { profile } = useAuth();
  if (!profile) return <Redirect href="/login" />;
  if (profile.role === "CUSTOMER") return <Redirect href="/discover" />;
  if (profile.role === "BUSINESS") {
    return profile.business?.status === "ACTIVE" ? <Redirect href="/sell" /> : <Redirect href="/pending-approval" />;
  }
  return <Redirect href="/admin-notice" />;
}
BITEGO_EOF

write apps/mobile/app/pending-approval.tsx <<'BITEGO_EOF'
import { useState } from "react";
import { Banner, Body, Button, Card, Screen, Title } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

// Shown to a business until an admin approves it. "Check again" re-reads the status from the server.
export default function PendingApproval() {
  const { profile, reload, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const business = profile?.business;
  const status = business?.status;
  const rejected = status === "REJECTED" || status === "SUSPENDED";

  async function check() {
    setChecking(true);
    await reload();
    setChecking(false);
  }

  return (
    <Screen centered>
      <Title>{rejected ? "Business not approved" : "Waiting for approval"}</Title>
      {business ? (
        <Card>
          <Body>{business.name}</Body>
          <Body muted>Status: {status}</Body>
        </Card>
      ) : null}
      {rejected ? (
        <Banner tone="error">
          {business?.verification?.remarks ?? "Your business could not be approved. Please contact support."}
        </Banner>
      ) : (
        <Banner tone="warning">
          An admin is reviewing your business. You can post surplus food as soon as it is approved.
        </Banner>
      )}
      {!rejected ? <Button title="Check again" onPress={check} loading={checking} /> : null}
      <Button title="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
BITEGO_EOF

write apps/mobile/src/api/auth.ts <<'BITEGO_EOF'
import type { MeResponse, RegisterInput, RegisterResponse } from "@bitego/shared";
import { apiFetch } from "@/api/client";

export const registerAccount = (input: RegisterInput) =>
  apiFetch<RegisterResponse>("/auth/register", { method: "POST", body: input, auth: false });

export const fetchMe = () => apiFetch<MeResponse>("/auth/me");
BITEGO_EOF

write apps/mobile/src/api/client.ts <<'BITEGO_EOF'
import type { ApiErrorBody } from "@bitego/shared";
import { env } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";

// The only place that talks to our backend. Every API call in the app goes through apiFetch:
//   const me = await apiFetch<MeResponse>("/auth/me");
// It adds the login token, reads our { data } / { error } response format and turns failures into ApiRequestError.

export class ApiRequestError extends Error {
  constructor(
    public status: number, // 0 = the server could not be reached
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Options = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; auth?: boolean };

const TIMEOUT_MS = 15000;

export async function apiFetch<T>(path: string, { method, body, auth = true }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const { data } = await getSupabase().auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}/api/v1${path}`, {
      method: method ?? (body !== undefined ? "POST" : "GET"),
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // empty or non-JSON body
  }

  if (!res.ok) {
    const error = (json as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      res.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? `Request failed (${res.status})`,
      error?.details,
    );
  }
  return (json as { data: T }).data;
}
BITEGO_EOF

write apps/mobile/src/components/LocationPicker.tsx <<'BITEGO_EOF'
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type MapPressEvent, type Region } from "react-native-maps";
import { Body, Button, ErrorText } from "@/components/ui";
import { theme } from "@/lib/theme";

// Lets a business set its shop location: press "Use my current location" while at the shop,
// then tap the map or drag the pin to adjust. The saved latitude/longitude are used for distance search.
// (The browser build uses LocationPicker.web.tsx, which has the button but no map.)

export type Coordinates = { latitude: number; longitude: number };

const SRI_LANKA: Region = { latitude: 7.5, longitude: 80.7, latitudeDelta: 4, longitudeDelta: 4 };

export function LocationPicker({
  value,
  onChange,
  error,
}: {
  value: Coordinates | null;
  onChange: (c: Coordinates) => void;
  error?: string;
}) {
  const map = useRef<MapView>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (value) map.current?.animateToRegion({ ...value, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
  }, [value]);

  async function useCurrentLocation() {
    setMessage(null);
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setMessage("Location permission was denied. Allow it in your phone settings, or place the pin on the map.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setMessage("Could not get your location. Turn on GPS, or place the pin on the map.");
    } finally {
      setBusy(false);
    }
  }

  const onMapPress = (e: MapPressEvent) => onChange(e.nativeEvent.coordinate);

  return (
    <View style={{ gap: 8 }}>
      <Button title="Use my current location" variant="secondary" onPress={useCurrentLocation} loading={busy} />
      <MapView
        ref={map}
        style={styles.map}
        initialRegion={value ? { ...value, latitudeDelta: 0.01, longitudeDelta: 0.01 } : SRI_LANKA}
        onPress={onMapPress}
      >
        {value ? (
          <Marker coordinate={value} draggable onDragEnd={(e) => onChange(e.nativeEvent.coordinate)} />
        ) : null}
      </MapView>
      {value ? (
        <Text style={styles.coords}>
          Latitude {value.latitude.toFixed(5)}, longitude {value.longitude.toFixed(5)}
        </Text>
      ) : (
        <Body muted>Tap the map to place the pin, or use your current location.</Body>
      )}
      {message ? <Text style={{ color: theme.warning, fontSize: 13 }}>{message}</Text> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 220, borderRadius: theme.radius, overflow: "hidden" },
  coords: { fontSize: 13, color: theme.muted },
});
BITEGO_EOF

write apps/mobile/src/components/LocationPicker.web.tsx <<'BITEGO_EOF'
import * as Location from "expo-location";
import { useState } from "react";
import { Text, View } from "react-native";
import { Body, Button, ErrorText } from "@/components/ui";
import { theme } from "@/lib/theme";

// Browser version of LocationPicker: react-native-maps does not run in a browser,
// so this has only the "Use my current location" button. The phone app shows the map.

export type Coordinates = { latitude: number; longitude: number };

export function LocationPicker({
  value,
  onChange,
  error,
}: {
  value: Coordinates | null;
  onChange: (c: Coordinates) => void;
  error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function useCurrentLocation() {
    setMessage(null);
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setMessage("Location permission was denied.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setMessage("Could not get your location.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Button title="Use my current location" variant="secondary" onPress={useCurrentLocation} loading={busy} />
      {value ? (
        <Text style={{ fontSize: 13, color: theme.muted }}>
          Latitude {value.latitude.toFixed(5)}, longitude {value.longitude.toFixed(5)}
        </Text>
      ) : (
        <Body muted>The map is shown in the phone app.</Body>
      )}
      {message ? <Text style={{ color: theme.warning, fontSize: 13 }}>{message}</Text> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
BITEGO_EOF

write apps/mobile/src/components/Placeholder.tsx <<'BITEGO_EOF'
import { Banner, Body, Screen, Title } from "@/components/ui";

// Temporary content for screens that a team member will build. Replace the whole file's usage
// with the real screen when you implement it.
export function Placeholder({ title, owner, description }: { title: string; owner: string; description: string }) {
  return (
    <Screen>
      <Title>{title}</Title>
      <Body muted>{description}</Body>
      <Banner>Coming soon. Module owner: {owner}.</Banner>
    </Screen>
  );
}
BITEGO_EOF

write apps/mobile/src/components/ui.tsx <<'BITEGO_EOF'
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";

// Small set of reusable building blocks so all screens look the same.
// Add new shared components here (or next to this file) instead of copying styles around.

export function Screen({ children, scroll = true, centered = false }: { children: ReactNode; scroll?: boolean; centered?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, centered && styles.centered]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.flex, centered && styles.centered]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: theme.muted }]}>{children}</Text>;
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Banner({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "error" }) {
  const bg = tone === "error" ? "#FDECEA" : tone === "warning" ? theme.warningSoft : theme.primarySoft;
  const fg = tone === "error" ? theme.danger : tone === "warning" ? theme.warning : theme.primaryDark;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words";
  placeholder?: string;
  multiline?: boolean;
  optional?: boolean;
};

export function TextField({ label, error, optional, secure, multiline, ...rest }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={{ color: theme.muted, fontWeight: "400" }}>  (optional)</Text> : null}
      </Text>
      <TextInput
        value={rest.value}
        onChangeText={rest.onChangeText}
        placeholder={rest.placeholder}
        placeholderTextColor="#A0A09A"
        secureTextEntry={secure}
        keyboardType={rest.keyboardType}
        autoCapitalize={rest.autoCapitalize ?? "sentences"}
        autoCorrect={false}
        multiline={multiline}
        style={[styles.input, multiline && { height: 88, textAlignVertical: "top" }, !!error && { borderColor: theme.danger }]}
      />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading = false,
  variant = "primary",
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "link";
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && { backgroundColor: theme.primary },
        variant === "secondary" && { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.primary },
        variant === "link" && { backgroundColor: "transparent", minHeight: 40 },
        isDisabled && { opacity: 0.55 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : theme.primary} />
      ) : (
        <Text style={[styles.buttonText, variant !== "primary" && { color: theme.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
            >
              <Text style={{ color: selected ? "#fff" : theme.text, fontSize: 14 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const content = <View style={styles.card}>{children}</View>;
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.8 }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={[styles.flex, styles.centered, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      {label ? <Text style={{ marginTop: 12, color: theme.muted }}>{label}</Text> : null}
    </View>
  );
}

export const Spacer = ({ size = theme.space.md }: { size?: number }) => <View style={{ height: size }} />;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: theme.space.lg, paddingBottom: theme.space.xl * 2, gap: theme.space.sm },
  centered: { justifyContent: "center", alignItems: "stretch", flexGrow: 1 },
  title: { fontSize: 28, fontWeight: "700", color: theme.text },
  heading: { fontSize: 18, fontWeight: "600", color: theme.text, marginTop: theme.space.md },
  body: { fontSize: 16, lineHeight: 22, color: theme.text },
  error: { color: theme.danger, fontSize: 13, marginTop: 4 },
  banner: { padding: theme.space.md, borderRadius: theme.radius },
  field: { gap: 4, marginTop: theme.space.sm },
  label: { fontSize: 14, fontWeight: "600", color: theme.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: theme.card,
    color: theme.text,
  },
  button: {
    minHeight: 50,
    borderRadius: theme.radius,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space.lg,
    marginTop: theme.space.sm,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: theme.space.md,
    gap: 4,
  },
});
BITEGO_EOF

write apps/mobile/src/features/auth/AuthProvider.tsx <<'BITEGO_EOF'
import type { MeResponse, RegisterInput } from "@bitego/shared";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { fetchMe, registerAccount } from "@/api/auth";
import { ApiRequestError } from "@/api/client";
import { getSupabase } from "@/lib/supabase";

// Who is signed in. Wrap the app in <AuthProvider> and read it with useAuth().
//   status "loading"   checking the saved session / loading the profile
//   status "signedOut" nobody signed in
//   status "signedIn"  `profile` is the user's profile (role, business and its approval status)
//   status "error"     signed in but the server could not be reached (show a retry screen)

type Status = "loading" | "signedOut" | "signedIn" | "error";

type AuthValue = {
  status: Status;
  profile: MeResponse | null;
  errorMessage: string | null;
  notice: string | null; // e.g. "This account is not active", shown on the login screen
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [profileFailed, setProfileFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 1. Restore the saved session and follow sign-in / sign-out / token refresh.
  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // 2. Refresh tokens only while the app is open.
  useEffect(() => {
    const supabase = getSupabase();
    const apply = (state: AppStateStatus) =>
      state === "active" ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh();
    apply(AppState.currentState);
    const sub = AppState.addEventListener("change", apply);
    return () => sub.remove();
  }, []);

  // 3. Load our profile (role, business status) whenever the signed-in user changes.
  const loadProfile = useCallback(async () => {
    setProfileFailed(false);
    try {
      setProfile(await fetchMe());
      setNotice(null);
    } catch (err) {
      const e = err instanceof ApiRequestError ? err : null;
      if (e && (e.status === 401 || e.code === "PROFILE_NOT_FOUND" || e.code === "ACCOUNT_DISABLED")) {
        setNotice(e.status === 401 ? null : e.message);
        await getSupabase().auth.signOut();
        return;
      }
      setErrorMessage(e?.message ?? "Something went wrong. Try again.");
      setProfileFailed(true);
    }
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileFailed(false);
      return;
    }
    void loadProfile();
  }, [userId, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      throw new Error(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
    }
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      await registerAccount(input); // throws ApiRequestError with a readable message
      try {
        await signIn(input.email, input.password);
      } catch {
        throw new Error("Your account was created. Please log in.");
      }
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    setNotice(null);
    await getSupabase().auth.signOut();
  }, []);

  const status: Status = !sessionReady
    ? "loading"
    : !session
      ? "signedOut"
      : profile
        ? "signedIn"
        : profileFailed
          ? "error"
          : "loading";

  const value = useMemo<AuthValue>(
    () => ({ status, profile, errorMessage, notice, signIn, register, signOut, reload: loadProfile }),
    [status, profile, errorMessage, notice, signIn, register, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
BITEGO_EOF

write apps/mobile/src/features/auth/formErrors.ts <<'BITEGO_EOF'
// Turns validation problems into { "fieldName": "message" } so each input can show its own error.
// Works for both client-side zod issues (path is an array) and API errors (path is "business.name").
type Issue = { path: PropertyKey[] | string; message: string };

export function toFieldErrors(issues: Issue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = (Array.isArray(issue.path) ? issue.path.map(String).join(".") : issue.path) || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
BITEGO_EOF

write apps/mobile/src/features/profile/ProfileView.tsx <<'BITEGO_EOF'
import { Text } from "react-native";
import { useAuth } from "@/features/auth/AuthProvider";
import { Body, Button, Card, Heading, Screen, Spacer, Title } from "@/components/ui";

const ROLE_LABEL = { CUSTOMER: "Customer", BUSINESS: "Business", ADMIN: "Admin" } as const;

// Account tab used by customers and businesses. Edit profile, notification settings etc. will be added here.
export function ProfileView() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;

  return (
    <Screen>
      <Title>Account</Title>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{profile.fullName}</Text>
        <Body muted>{profile.email}</Body>
        {profile.phone ? <Body muted>{profile.phone}</Body> : null}
        <Body>{ROLE_LABEL[profile.role]}</Body>
      </Card>
      {profile.business ? (
        <>
          <Heading>Your business</Heading>
          <Card>
            <Text style={{ fontSize: 16, fontWeight: "600" }}>{profile.business.name}</Text>
            <Body muted>Status: {profile.business.status}</Body>
          </Card>
        </>
      ) : null}
      <Spacer />
      <Button title="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
BITEGO_EOF

write apps/mobile/src/lib/env.ts <<'BITEGO_EOF'
// Environment values come from apps/mobile/.env (copy .env.example). They are baked into the app
// at build time, so only public values belong here. Restart Expo after changing .env
// (run `npx expo start -c`).
const raw = {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

const trimSlash = (v: string | undefined) => (v ?? "").trim().replace(/\/+$/, "");

export const env = {
  apiUrl: trimSlash(raw.EXPO_PUBLIC_API_URL),
  supabaseUrl: trimSlash(raw.EXPO_PUBLIC_SUPABASE_URL),
  // The Supabase publishable key (formerly "anon" key). Safe to ship in the app.
  supabaseKey: (raw.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
};

// Human-readable problems with the configuration; an empty list means all good.
export const configProblems: string[] = (() => {
  const problems: string[] = [];
  for (const [name, value] of Object.entries(raw)) {
    if (!value || !value.trim()) problems.push(`${name} is missing`);
  }
  if (env.supabaseUrl) {
    try {
      const url = new URL(env.supabaseUrl);
      if (url.pathname !== "/") {
        problems.push("EXPO_PUBLIC_SUPABASE_URL must be only https://<project>.supabase.co (no path after it)");
      }
    } catch {
      problems.push("EXPO_PUBLIC_SUPABASE_URL is not a valid URL");
    }
  }
  if (env.apiUrl && !/^https?:\/\//.test(env.apiUrl)) {
    problems.push("EXPO_PUBLIC_API_URL must start with http:// or https://");
  }
  return problems;
})();
BITEGO_EOF

write apps/mobile/src/lib/secureStorage.ts <<'BITEGO_EOF'
import * as SecureStore from "expo-secure-store";

// Supabase keeps the login session (tokens) in this storage so the user stays signed in.
// SecureStore encrypts the data using the phone's keystore, but each value is limited to about
// 2 KB and a session is larger, so the value is split into chunks.
const CHUNK_SIZE = 1800;
const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

export const chunkedSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = Number(await SecureStore.getItemAsync(countKey(key)));
    if (!count) return null;
    let value = "";
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part === null) return null; // incomplete data: treat as signed out
      value += part;
    }
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    const previous = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
    for (let i = chunks.length; i < previous; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
  },

  async removeItem(key: string): Promise<void> {
    const count = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
BITEGO_EOF

write apps/mobile/src/lib/supabase.ts <<'BITEGO_EOF'
import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { env } from "@/lib/env";
import { chunkedSecureStorage } from "@/lib/secureStorage";

// Supabase is used only for signing in and keeping the session.
// All app data goes through our own API (src/api), never directly to Supabase tables.
let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: {
        // On the phone the session is kept in encrypted storage. (The browser build uses its default.)
        ...(Platform.OS !== "web" ? { storage: chunkedSecureStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
BITEGO_EOF

write apps/mobile/src/lib/theme.ts <<'BITEGO_EOF'
// Colours and spacing used across the app. Change them here, not in each screen.
export const theme = {
  primary: "#2E7D32",
  primaryDark: "#1B5E20",
  primarySoft: "#E8F5E9",
  background: "#FAFAF7",
  card: "#FFFFFF",
  text: "#1B1B1B",
  muted: "#6B6B6B",
  border: "#D9D9D2",
  danger: "#C62828",
  warning: "#B26A00",
  warningSoft: "#FFF3E0",
  radius: 12,
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
} as const;
BITEGO_EOF

write docs/architecture/mobile.md <<'BITEGO_EOF'
# Mobile app (apps/mobile)

Expo SDK 57 + React Native + Expo Router. Everything in `src/` is imported with the `@/` alias (`@/lib/theme`).

## How screens are chosen

`app/_layout.tsx` wraps the app in `AuthProvider` and uses `Stack.Protected` guards:

| Who | Screens |
| --- | --- |
| Signed out | `(auth)`: login, register, register-customer, register-business |
| CUSTOMER | `(customer)` tabs: discover, reservations, account |
| BUSINESS, status ACTIVE | `(business)` tabs: sell, buy, orders, shop |
| BUSINESS, not ACTIVE | `pending-approval` (Check again / Log out) |
| ADMIN | `admin-notice` (admins use the web dashboard) |

A user can never open a screen of another group. Do not add your own role checks in screens.
To add a screen, create a file in the right folder; to add a tab, also add a `<Tabs.Screen>` line in that folder's `_layout.tsx`.

## Where things live

- `src/lib/env.ts` reads `EXPO_PUBLIC_*` variables and reports mistakes (shown on a "Setup needed" screen).
- `src/lib/supabase.ts` Supabase client. Used only for sign-in and the saved session (stored encrypted with SecureStore, see `secureStorage.ts`). All data goes through our API, never directly to Supabase.
- `src/api/client.ts` `apiFetch(path, { method, body })` adds the login token, 15 s timeout, and turns errors into `ApiRequestError(status, code, message, details)`. Add one file per module next to `auth.ts` (for example `api/listings.ts`).
- `src/features/auth/AuthProvider.tsx` `useAuth()` gives `profile` (role, business and its approval status), `signIn`, `register`, `signOut`, `reload`.
- `src/components/ui.tsx` shared Screen, TextField, Button, ChoiceChips, Card, Banner. `src/lib/theme.ts` colours and spacing.
- `src/components/LocationPicker.tsx` GPS button + map pin (phone). `LocationPicker.web.tsx` is the browser version without the map.
- `src/components/Placeholder.tsx` temporary "coming soon" body. Delete its use when you build the real screen.

## Rules

- Never import `@supabase/supabase-js` in a screen. Use `apiFetch`.
- Validate forms with the schemas in `packages/shared` (same rules as the API).
- Only `EXPO_PUBLIC_*` values go in `.env`, and they are public. Never put the Supabase secret key or database URLs here.
- After changing `.env`, restart with `npx expo start -c`.
- Android maps: Expo Go shows the map without a key. A development or release build needs a Google Maps API key (`android.config.googleMaps.apiKey` in `app.json`) restricted to package `com.bitego.app`.
BITEGO_EOF


# Remove the starter files and the folders from the first folder structure that the new layout replaces.
rm -f apps/mobile/App.tsx apps/mobile/index.ts
rm -rf "apps/mobile/app/(provider)" "apps/mobile/app/(buyer)"
rm -f apps/mobile/src/api/.gitkeep apps/mobile/src/components/.gitkeep apps/mobile/src/features/auth/.gitkeep apps/mobile/src/features/profile/.gitkeep apps/mobile/src/lib/.gitkeep

# Patch package.json, app.json and tsconfig.json (safe to run twice).
node - <<'NODE_EOF'
const fs = require("fs");
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const save = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + "\n");

const pkg = read("apps/mobile/package.json");
pkg.main = "expo-router/entry";
save("apps/mobile/package.json", pkg);

const app = read("apps/mobile/app.json");
const e = app.expo;
e.name = "BiteGo";
e.slug = "bitego";
e.scheme = "bitego";
e.plugins = [
  "expo-router",
  "expo-secure-store",
  ["expo-location", { locationWhenInUsePermission: "BiteGo uses your location to set your shop location and to find food near you." }],
];
e.android = { ...e.android, package: "com.bitego.app" };
e.ios = { ...e.ios, bundleIdentifier: "com.bitego.app" };
e.web = { ...e.web, bundler: "metro" };
save("apps/mobile/app.json", app);

const ts = read("apps/mobile/tsconfig.json");
ts.compilerOptions = { ...ts.compilerOptions, paths: { "@/*": ["./src/*"] } };
ts.include = ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"];
save("apps/mobile/tsconfig.json", ts);
console.log("patched apps/mobile/package.json, app.json, tsconfig.json");
NODE_EOF

echo; echo "Files added. Now follow the remaining steps (install packages, run the app)."
