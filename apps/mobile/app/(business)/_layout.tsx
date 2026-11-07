import { Tabs } from "expo-router";
import { theme } from "@/lib/theme";

// Owner: Kalindu (do not edit). Each tab is a folder owned by one person, with its own _layout.tsx.
export default function BusinessLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.primary }}>
      <Tabs.Screen name="sell" options={{ title: "My listings" }} />
      <Tabs.Screen name="buy" options={{ title: "Buy" }} />
      <Tabs.Screen name="orders" options={{ title: "Orders" }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
      <Tabs.Screen name="shop" options={{ title: "Shop" }} />
    </Tabs>
  );
}
