import { addListingImageSchema } from "@bitego/shared";
import { z } from "zod";
import { ApiError, ok, parseBody, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { addListingImage } from "@/server/modules/listings/listings.service";

// POST /api/v1/seller/listings/:id/images
export const POST = route(async (req, ctx: RouteContext<"/api/v1/seller/listings/[id]/images">) => {
  const { business } = await requireApprovedBusiness(req);
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing not found");
  const { key } = await parseBody(req, addListingImageSchema);
  return ok(await addListingImage(business.id, id, key), 201);
});
