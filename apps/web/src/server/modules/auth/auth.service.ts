import type { RegisterInput } from "@bitego/shared";
import type { Business, User } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";

// Creates the Supabase login account and our own profile (users row, plus a PENDING
// business and its verification request for BUSINESS accounts).
// If saving the profile fails, the login account is deleted again, so we never keep half an account.
export async function registerAccount(input: RegisterInput) {
  const { email, phone } = input;

  const duplicate = await prisma.user.findFirst({
    where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
    select: { email: true },
  });
  if (duplicate) {
    throw new ApiError(
      409,
      "ACCOUNT_EXISTS",
      duplicate.email === email ? "An account with this email already exists" : "This phone number is already used",
    );
  }

  if (input.role === "BUSINESS" && input.business.registrationNo) {
    const taken = await prisma.business.findUnique({
      where: { registrationNo: input.business.registrationNo },
      select: { id: true },
    });
    if (taken) throw new ApiError(409, "REGISTRATION_NO_EXISTS", "This registration number is already used");
  }

  const admin = supabaseAdmin();
  // email_confirm: true marks the email as confirmed, so the user can sign in straight away.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists") {
      throw new ApiError(409, "ACCOUNT_EXISTS", "An account with this email already exists");
    }
    if (error?.code === "weak_password") {
      throw new ApiError(400, "WEAK_PASSWORD", "Choose a stronger password");
    }
    console.error("Supabase createUser failed:", error);
    throw new ApiError(502, "AUTH_PROVIDER_ERROR", "Could not create the account. Try again later");
  }
  const authId = data.user.id;

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { id: authId, email, phone: phone ?? null, fullName: input.fullName, role: input.role },
        select: { id: true, email: true, fullName: true, role: true, status: true },
      });

      if (input.role !== "BUSINESS") return { user, business: null };

      const b = input.business;
      const business = await tx.business.create({
        data: {
          ownerId: authId,
          name: b.name,
          type: b.type,
          registrationNo: b.registrationNo ?? null,
          description: b.description ?? null,
          contactNo: b.contactNo,
          email: b.email ?? null,
          addressLine: b.addressLine,
          city: b.city,
          district: b.district ?? null,
          latitude: b.latitude,
          longitude: b.longitude,
          status: "PENDING",
        },
        select: { id: true, name: true, status: true },
      });
      await tx.businessVerification.create({
        data: { businessId: business.id, documentUrl: b.documentUrl ?? null },
      });
      return { user, business };
    });
  } catch (err) {
    await admin.auth.admin.deleteUser(authId).catch((e) => console.error("Rollback deleteUser failed:", e));
    throw err;
  }
}

// The signed-in user's profile, plus their business and its latest approval status.
export async function getProfile(user: User, business: Business | null) {
  const verification = business
    ? await prisma.businessVerification.findFirst({
        where: { businessId: business.id },
        orderBy: { submittedAt: "desc" },
        select: { status: true, remarks: true, reviewedAt: true },
      })
    : null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    profilePictureUrl: user.profilePictureUrl,
    business: business
      ? { id: business.id, name: business.name, type: business.type, status: business.status, verification }
      : null,
  };
}
