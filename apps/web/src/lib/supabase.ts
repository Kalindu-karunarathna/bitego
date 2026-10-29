import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Supabase client with the secret key. Server code only (route handlers, server/modules).
// Never import this in a client component or the mobile app: it can do anything.
// Used to create accounts and to check the login token sent by the app.

let client: SupabaseClient | undefined;

export function supabaseAdmin() {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
