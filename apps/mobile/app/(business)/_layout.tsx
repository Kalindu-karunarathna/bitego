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
