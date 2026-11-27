import { updateBusinessSchema } from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { getMyBusiness, updateMyBusiness } from "@/server/modules/businesses/businesses.service";

// GET /api/v1/seller/business
export const GET = route(async (req) => {
  const { business } = await requireApprovedBusiness(req);
  return ok(await getMyBusiness(business));
});

// PATCH /api/v1/seller/business
export const PATCH = route(async (req) => {
  const { user, business } = await requireApprovedBusiness(req);
  const input = await parseBody(req, updateBusinessSchema);
  return ok(await updateMyBusiness(business.id, user.id, input));
});
