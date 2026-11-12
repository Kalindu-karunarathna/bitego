import { connection } from "next/server";
import { pickupRouteRequestSchema } from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { getPickupRoute } from "@/server/modules/notifications/pickup-route.service";

export const POST = route(async (req) => {
  await connection();
  const { user } = await requireRole(req, "CUSTOMER", "BUSINESS");
  const input = await parseBody(req, pickupRouteRequestSchema);
  const response = ok(await getPickupRoute(user.id, input));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
