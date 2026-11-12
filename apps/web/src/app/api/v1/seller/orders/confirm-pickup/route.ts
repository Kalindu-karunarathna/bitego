import { pickupCodeSchema } from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { confirmPickup } from "@/server/modules/orders/orders.service";

// POST /api/v1/seller/orders/confirm-pickup  (marks the reservation PICKED_UP)
export const POST = route(async (req) => {
  const { user, business } = await requireApprovedBusiness(req);
  const { code } = await parseBody(req, pickupCodeSchema);
  return ok(await confirmPickup(business.id, user.id, code));
});
