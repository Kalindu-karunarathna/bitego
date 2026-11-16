import { updateListingSchema } from "@bitego/shared";
import { z } from "zod";
import { ApiError, ok, parseBody, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { getMyListing, updateListing } from "@/server/modules/listings/listings.service";

const notFound = () => new ApiError(404, "LISTING_NOT_FOUND", "Listing not found");

// GET /api/v1/seller/listings/:id
export const GET = route(async (req, ctx: RouteContext<"/api/v1/seller/listings/[id]">) => {
  const { business } = await requireApprovedBusiness(req);
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw notFound();
  return ok(await getMyListing(business.id, id));
});

// PATCH /api/v1/seller/listings/:id
export const PATCH = route(async (req, ctx: RouteContext<"/api/v1/seller/listings/[id]">) => {
  const { user, business } = await requireApprovedBusiness(req);
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw notFound();
  const input = await parseBody(req, updateListingSchema);
  return ok(await updateListing(business.id, user.id, id, input));
});
