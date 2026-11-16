import { z } from "zod";
import { ApiError, ok, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { removeListingImage } from "@/server/modules/listings/listings.service";

// DELETE /api/v1/seller/listings/:id/images/:imageId
export const DELETE = route(async (req, ctx: RouteContext<"/api/v1/seller/listings/[id]/images/[imageId]">) => {
  const { business } = await requireApprovedBusiness(req);
  const { id, imageId } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing not found");
  if (!z.uuid().safeParse(imageId).success) throw new ApiError(404, "IMAGE_NOT_FOUND", "Photo not found");
  return ok(await removeListingImage(business.id, id, imageId));
});
