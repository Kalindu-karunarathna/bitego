
import type { ApiErrorBody } from "@bitego/shared";

import { env } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";

// The only place that talks to our backend.
// Adds authentication, handles API responses and retries once
// with a refreshed token if the access token is rejected.

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

const TIMEOUT_MS = 15000;

async function sendRequest(
  path: string,
  method: string,
  body: unknown,
  accessToken?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS,
  );

  try {
    return await fetch(`${env.apiUrl}/api/v1${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiRequestError(
      0,
      "NETWORK_ERROR",
      "Cannot reach the server. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function readResponse<T>(res: Response): Promise<T> {
  let json: unknown = null;

  try {
    json = await res.json();
  } catch {
    // Empty or non-JSON response.
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

export async function apiFetch<T>(
  path: string,
  {
    method,
    body,
    auth = true,
  }: Options = {},
): Promise<T> {
  const requestMethod =
    method ?? (body !== undefined ? "POST" : "GET");

  let accessToken: string | undefined;

  if (auth) {
    const { data, error } =
      await getSupabase().auth.getSession();

    if (error || !data.session?.access_token) {
      throw new ApiRequestError(
        401,
        "SESSION_EXPIRED",
        "Your session has expired. Please sign in again.",
      );
    }

    accessToken = data.session.access_token;
  }

  let res = await sendRequest(
    path,
    requestMethod,
    body,
    accessToken,
  );

  // If the backend rejects the token, refresh and retry once.
  if (auth && res.status === 401) {
    const { data, error } =
      await getSupabase().auth.refreshSession();

    if (error || !data.session?.access_token) {
      throw new ApiRequestError(
        401,
        "SESSION_EXPIRED",
        "Your session has expired. Please sign in again.",
      );
    }

    accessToken = data.session.access_token;

    res = await sendRequest(
      path,
      requestMethod,
      body,
      accessToken,
    );
  }

  return readResponse<T>(res);
}
