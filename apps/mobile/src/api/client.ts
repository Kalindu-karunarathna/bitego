import type { ApiErrorBody } from "@bitego/shared";
import { env } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";

// The only place that talks to our backend. Every API call in the app goes through apiFetch:
//   const me = await apiFetch<MeResponse>("/auth/me");
// It adds the login token, reads our { data } / { error } response format and turns failures into ApiRequestError.

export class ApiRequestError extends Error {
  constructor(
    public status: number, // 0 = the server could not be reached
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Options = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; auth?: boolean };

const TIMEOUT_MS = 15000;

export async function apiFetch<T>(path: string, { method, body, auth = true }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const { data } = await getSupabase().auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}/api/v1${path}`, {
      method: method ?? (body !== undefined ? "POST" : "GET"),
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // empty or non-JSON body
  }

  if (!res.ok) {
    const error = (json as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      res.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? `Request failed (${res.status})`,
      error?.details,
    );
  }
  return (json as { data: T }).data;
}
