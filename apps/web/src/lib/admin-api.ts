"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";

// Calls our own API from the admin dashboard with the signed-in admin's token.

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function adminFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { data } = await supabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AdminApiError(401, "UNAUTHENTICATED", "Please log in");

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new AdminApiError(0, "NETWORK_ERROR", "Could not reach the server");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.error) {
    const e = json?.error;
    throw new AdminApiError(res.status, e?.code ?? "UNKNOWN", e?.message ?? "Something went wrong");
  }
  return json.data as T;
}
