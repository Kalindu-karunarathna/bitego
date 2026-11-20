import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";

// Buyer module access: customers may buy directly; business accounts must be approved.
export async function requireBuyer(req: NextRequest) {
  const ctx = await requireRole(req, "CUSTOMER", "BUSINESS");

  if (
    ctx.user.role === "BUSINESS" &&
    (!ctx.business || ctx.business.status !== "ACTIVE")
  ) {
    throw new ApiError(
      403,
      "BUSINESS_NOT_APPROVED",
      "Your business must be approved before buying food",
    );
  }

  return ctx;
}
