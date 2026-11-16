import { listingImageUploadSchema } from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { createListingImageUpload } from "@/server/modules/uploads/uploads.service";

// POST /api/v1/uploads/listing-images  (a short-lived link for uploading one photo to S3)
export const POST = route(async (req) => {
  const { business } = await requireApprovedBusiness(req);
  const { contentType } = await parseBody(req, listingImageUploadSchema);
  return ok(await createListingImageUpload(business.id, contentType), 201);
});
