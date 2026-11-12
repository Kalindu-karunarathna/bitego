"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase client for the browser (admin dashboard login). It uses the PUBLISHABLE key only, which is safe in
// the browser. The secret key stays on the server (src/lib/supabase.ts). The session is kept in the browser's
// localStorage, and every admin request sends it as "Authorization: Bearer <token>".

let client: SupabaseClient | undefined;

export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env, then restart the dev server");
    }
    client = createClient(url, key);
  }
  return client;
}
