
import type {
  CategoryDto,
  DiscoveryResponse,
  ListingDto,
} from "@bitego/shared";
import { apiFetch } from "@/api/client";

export type DiscoverFilters = {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
};

export async function fetchDiscoverListings(
  filters: DiscoverFilters = {},
): Promise<DiscoveryResponse> {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }

  if (filters.minPrice !== undefined) {
    params.set("minPrice", String(filters.minPrice));
  }

  if (filters.maxPrice !== undefined) {
    params.set("maxPrice", String(filters.maxPrice));
  }

  // Buyer location
  if (filters.latitude !== undefined) {
    params.set("latitude", String(filters.latitude));
  }

  if (filters.longitude !== undefined) {
    params.set("longitude", String(filters.longitude));
  }

  // Optional distance radius
  if (filters.radiusKm !== undefined) {
    params.set("radiusKm", String(filters.radiusKm));
  }

  params.set("limit", String(filters.limit ?? 20));

  return apiFetch<DiscoveryResponse>(
    `/listings?${params.toString()}`,
  );
}

export async function fetchDiscoverCategories(): Promise<CategoryDto[]> {
  return apiFetch<CategoryDto[]>("/categories");
}

export async function fetchListingDetail(
  listingId: string,
): Promise<ListingDto> {
  return apiFetch<ListingDto>(
    `/listings/${encodeURIComponent(listingId)}`,
  );
}
