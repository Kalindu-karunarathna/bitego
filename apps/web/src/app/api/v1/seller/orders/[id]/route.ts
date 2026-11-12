import { z } from "zod";
import { ApiError, ok, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { getOrder } from "@/server/modules/orders/orders.service";

// GET /api/v1/seller/orders/:id
export const GET = route(async (req, ctx: RouteContext<"/api/v1/seller/orders/[id]">) => {
  const { business } = await requireApprovedBusiness(req);
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "ORDER_NOT_FOUND", "Reservation not found");
  return ok(await getOrder(business.id, id));
});
