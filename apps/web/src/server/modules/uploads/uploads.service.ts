import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { MAX_LISTING_IMAGE_BYTES, type ListingImageType, type ListingImageUploadDto } from "@bitego/shared";
import { z } from "zod";
import { ApiError } from "@/lib/http";

// Listing photos live in AWS S3. The phone uploads directly to S3 with a short-lived link from here,
// and the listing stores the photo's public URL. Owner: Kajanika.

const schema = z.object({
  AWS_REGION: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
});

const EXTENSIONS: Record<ListingImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UPLOAD_LINK_SECONDS = 300;

let cached: { client: S3Client; bucket: string; baseUrl: string } | undefined;

function s3() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("S3 is not configured. Set the AWS_* values in apps/web/.env");
    throw new ApiError(503, "UPLOADS_NOT_CONFIGURED", "Photo upload is not available right now");
  }
  const { AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = parsed.data;
  cached = {
    client: new S3Client({
      region: AWS_REGION,
      credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
    }),
    bucket: AWS_S3_BUCKET,
    baseUrl: `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/`,
  };
  return cached;
}

export async function createListingImageUpload(
  businessId: string,
  contentType: ListingImageType,
): Promise<ListingImageUploadDto> {
  const { client, bucket, baseUrl } = s3();
  const key = `listings/${businessId}/${randomUUID()}.${EXTENSIONS[contentType]}`;
  const { url, fields } = await createPresignedPost(client, {
    Bucket: bucket,
    Key: key,
    Fields: { "Content-Type": contentType },
    Conditions: [
      ["content-length-range", 1, MAX_LISTING_IMAGE_BYTES],
      ["eq", "$Content-Type", contentType],
    ],
    Expires: UPLOAD_LINK_SECONDS,
  });
  return { key, imageUrl: baseUrl + key, uploadUrl: url, fields, maxBytes: MAX_LISTING_IMAGE_BYTES };
}

// A key is only accepted for the business it was issued to, so nobody can attach another shop's photo.
export function listingImageUrl(businessId: string, key: string): string {
  if (!key.startsWith(`listings/${businessId}/`)) {
    throw new ApiError(400, "INVALID_IMAGE", "This photo cannot be used");
  }
  return s3().baseUrl + key;
}

// Best effort: a leftover file must never make removing a photo fail.
export async function deleteListingImageFile(imageUrl: string): Promise<void> {
  try {
    const { client, bucket, baseUrl } = s3();
    if (!imageUrl.startsWith(baseUrl)) return;
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: imageUrl.slice(baseUrl.length) }));
  } catch (err) {
    console.error("Could not delete listing photo from S3:", err);
  }
}
