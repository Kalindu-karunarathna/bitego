import { discoveryFiltersSchema } from "@bitego/shared";

import { ok, route } from "@/lib/http";
import { requireBuyer } from "@/server/modules/buyer/buyer-auth";
import { discoverListings } from "@/server/modules/discovery/discovery.service";

// GET /api/v1/listings
export const GET = route(async (req) => {
  const { user } = await requireBuyer(req);

  const filters = discoveryFiltersSchema.parse(
    Object.fromEntries(
      req.nextUrl.searchParams.entries(),
    ),
  );

  const result = await discoverListings(
    filters,
    user.id,
    user.role,
  );

  return ok(result);
});