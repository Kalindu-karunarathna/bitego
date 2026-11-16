import { pickupCodeSchema } from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { verifyPickupCode } from "@/server/modules/orders/orders.service";

// POST /api/v1/seller/orders/verify  (checks the code, changes nothing)
export const POST = route(async (req) => {
  const { business } = await requireApprovedBusiness(req);
  const { code } = await parseBody(req, pickupCodeSchema);
  return ok(await verifyPickupCode(business.id, code));
});
