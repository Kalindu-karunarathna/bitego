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
