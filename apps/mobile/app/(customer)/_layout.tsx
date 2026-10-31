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
