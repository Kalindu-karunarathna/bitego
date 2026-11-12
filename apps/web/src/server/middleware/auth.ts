import type { NextRequest } from "next/server";
import type { Business, Role, User } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";

// How a protected route knows who is calling:
//   const { user } = await requireUser(req);                        any signed-in user
//   const { user } = await requireRole(req, "ADMIN");               specific role(s)
//   const { user, business } = await requireApprovedBusiness(req);  business approved by an admin
//
// The mobile app signs in with Supabase and sends the access token as
//   Authorization: Bearer <token>
// We verify the token with Supabase, then load the matching row from our users table.
// The role always comes from our database, never from the request.

export type AuthContext = { user: User; business: Business | null };

export async function requireUser(req: NextRequest): Promise<AuthContext> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Missing access token");

  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid or expired access token");
  }

  const found = await prisma.user.findUnique({
    where: { id: data.user.id },
    include: { business: true },
  });
  if (!found) {
    throw new ApiError(403, "PROFILE_NOT_FOUND", "No BiteGo profile exists for this account");
  }
  if (found.status !== "ACTIVE") {
    throw new ApiError(403, "ACCOUNT_DISABLED", "This account is not active");
  }

  const { business, ...user } = found;
  return { user, business };
}

export async function requireRole(req: NextRequest, ...roles: Role[]): Promise<AuthContext> {
  const ctx = await requireUser(req);
  if (!roles.includes(ctx.user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to do this");
  }
  return ctx;
}

// A business can sell or buy only after an admin approves it (status ACTIVE).
export async function requireApprovedBusiness(req: NextRequest) {
  const { user, business } = await requireRole(req, "BUSINESS");
  if (!business || business.status !== "ACTIVE") {
    throw new ApiError(403, "BUSINESS_NOT_APPROVED", "Your business is not approved yet");
  }
  return { user, business };
}
