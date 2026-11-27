import { Stack } from "expo-router";

// Owner: Sachira. Every screen file you add inside this folder is automatically part of this stack.
export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
