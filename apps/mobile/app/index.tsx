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
