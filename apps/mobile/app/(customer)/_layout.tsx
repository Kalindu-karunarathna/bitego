import { Tabs } from "expo-router";
import { theme } from "@/lib/theme";

// Owner: Kalindu (do not edit). Each tab is a folder owned by one person, with its own _layout.tsx.
export default function CustomerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.primary }}>
      <Tabs.Screen name="discover" options={{ title: "Discover" }} />
      <Tabs.Screen name="reservations" options={{ title: "Reservations" }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}
