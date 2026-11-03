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
