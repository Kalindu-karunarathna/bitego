import { Platform } from "react-native";
import type {
  ActivityPeriod,
  CancelListingInput,
  CategoryDto,
  CreateListingInput,
  ListingImageType,
  ListingImageUploadDto,
  SellerActivityDto,
  SellerBusinessDto,
  SellerListingDto,
  SellerOrderDto,
  SellerOrderFilter,
  UpdateBusinessInput,
  UpdateListingInput,
} from "@bitego/shared";
import { LISTING_IMAGE_TYPES } from "@bitego/shared";
import { apiFetch, ApiRequestError } from "@/api/client";

// Every seller API call used by the mobile app. The API is described in docs/api/seller.md. Owner: Kajanika.

export const fetchCategories = () => apiFetch<CategoryDto[]>("/categories", { auth: false });

// ---------- Listings ----------

export const fetchMyListings = () => apiFetch<SellerListingDto[]>("/seller/listings");
export const fetchMyListing = (id: string) => apiFetch<SellerListingDto>(`/seller/listings/${id}`);
export const createListing = (input: CreateListingInput) =>
  apiFetch<SellerListingDto>("/seller/listings", { method: "POST", body: input });
export const updateListing = (id: string, input: UpdateListingInput) =>
  apiFetch<SellerListingDto>(`/seller/listings/${id}`, { method: "PATCH", body: input });
export const cancelListing = (id: string, input: CancelListingInput) =>
  apiFetch<SellerListingDto>(`/seller/listings/${id}/cancel`, { method: "POST", body: input });
export const addListingImage = (id: string, key: string) =>
  apiFetch<SellerListingDto>(`/seller/listings/${id}/images`, { method: "POST", body: { key } });
export const removeListingImage = (id: string, imageId: string) =>
  apiFetch<SellerListingDto>(`/seller/listings/${id}/images/${imageId}`, { method: "DELETE" });

// ---------- Photo upload ----------

const UPLOAD_TIMEOUT_MS = 60000;
const EXTENSIONS: Record<ListingImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Gets a short-lived link from our API, then sends the photo straight to S3. Returns the key for the listing.
export async function uploadListingPhoto(photo: { uri: string; mimeType?: string | null }): Promise<string> {
  const allowed = LISTING_IMAGE_TYPES.find((t) => t === photo.mimeType);
  const contentType: ListingImageType = allowed ?? "image/jpeg";
  const upload = await apiFetch<ListingImageUploadDto>("/uploads/listing-images", {
    method: "POST",
    body: { contentType },
  });

  // S3 needs the signed fields first and the file last.
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
  if (Platform.OS === "web") {
    form.append("file", await (await fetch(photo.uri)).blob());
  } else {
    const file = { uri: photo.uri, name: `photo.${EXTENSIONS[contentType]}`, type: contentType };
    form.append("file", file as unknown as Blob);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(upload.uploadUrl, { method: "POST", body: form, signal: controller.signal });
    if (!res.ok) {
      throw new ApiRequestError(res.status, "UPLOAD_FAILED", "The photo could not be uploaded. It may be larger than 5 MB.");
    }
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError(0, "UPLOAD_FAILED", "The photo could not be uploaded. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  return upload.key;
}

// ---------- Business profile ----------

export const fetchMyBusiness = () => apiFetch<SellerBusinessDto>("/seller/business");
export const updateMyBusiness = (input: UpdateBusinessInput) =>
  apiFetch<SellerBusinessDto>("/seller/business", { method: "PATCH", body: input });

// ---------- Orders ----------

export function fetchOrders(status: SellerOrderFilter = "ALL", listingId?: string) {
  const query = `status=${status}${listingId ? `&listingId=${listingId}` : ""}`;
  return apiFetch<SellerOrderDto[]>(`/seller/orders?${query}`);
}
export const fetchOrder = (id: string) => apiFetch<SellerOrderDto>(`/seller/orders/${id}`);
export const fetchActivity = (period: ActivityPeriod) => apiFetch<SellerActivityDto>(`/seller/activity?period=${period}`);
export const verifyPickupCode = (code: string) =>
  apiFetch<SellerOrderDto>("/seller/orders/verify", { method: "POST", body: { code } });
export const confirmPickup = (code: string) =>
  apiFetch<SellerOrderDto>("/seller/orders/confirm-pickup", { method: "POST", body: { code } });
