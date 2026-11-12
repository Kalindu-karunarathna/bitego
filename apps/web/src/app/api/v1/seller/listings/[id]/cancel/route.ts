import { cancelListingSchema } from "@bitego/shared";
import { z } from "zod";
import { ApiError, ok, parseBody, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { cancelListing } from "@/server/modules/listings/listings.service";

// POST /api/v1/seller/listings/:id/cancel
export const POST = route(async (req, ctx: RouteContext<"/api/v1/seller/listings/[id]/cancel">) => {
  const { user, business } = await requireApprovedBusiness(req);
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing not found");
  const input = await parseBody(req, cancelListingSchema);
  return ok(await cancelListing(business.id, user.id, id, input));
});
