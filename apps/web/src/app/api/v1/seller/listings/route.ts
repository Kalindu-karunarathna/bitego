import { createListingSchema, SELLER_LISTING_FILTERS } from "@bitego/shared";
import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { createListing, listMyListings } from "@/server/modules/listings/listings.service";

const query = z.object({ status: z.enum(SELLER_LISTING_FILTERS).default("ALL") });

// GET /api/v1/seller/listings?status=ALL
export const GET = route(async (req) => {
  const { business } = await requireApprovedBusiness(req);
  const { status } = query.parse({ status: req.nextUrl.searchParams.get("status") ?? undefined });
  return ok(await listMyListings(business.id, status));
});

// POST /api/v1/seller/listings
export const POST = route(async (req) => {
  const { user, business } = await requireApprovedBusiness(req);
  const input = await parseBody(req, createListingSchema);
  return ok(await createListing(business.id, user.id, input), 201);
});
