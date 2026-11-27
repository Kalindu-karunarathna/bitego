import { ok, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { getListingDetail } from "@/server/modules/discovery/discovery.service";

// GET /api/v1/listings/:id
export const GET = route(
  async (
    req,
    context,
  ) => {
    const { user } = await requireRole(
      req,
      "CUSTOMER",
      "BUSINESS",
    );

    const { id } = await context.params;

    const listing = await getListingDetail(
      id,
      user.id,
      user.role,
    );

    return ok(listing);
  },
);