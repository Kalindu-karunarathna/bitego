import type { MeResponse, RegisterInput, RegisterResponse } from "@bitego/shared";
import { apiFetch } from "@/api/client";

export const registerAccount = (input: RegisterInput) =>
  apiFetch<RegisterResponse>("/auth/register", { method: "POST", body: input, auth: false });

export const fetchMe = () => apiFetch<MeResponse>("/auth/me");
