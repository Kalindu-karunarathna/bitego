import { discoveryFiltersSchema } from "@bitego/shared";

import { ok, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { discoverListings } from "@/server/modules/discovery/discovery.service";

// GET /api/v1/listings
export const GET = route(async (req) => {
  const { user } = await requireRole(
    req,
    "CUSTOMER",
    "BUSINESS",
  );

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