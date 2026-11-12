import { SELLER_ORDER_FILTERS } from "@bitego/shared";
import { z } from "zod";
import { ok, route } from "@/lib/http";
import { requireApprovedBusiness } from "@/server/middleware/auth";
import { listOrders } from "@/server/modules/orders/orders.service";

const query = z.object({
  status: z.enum(SELLER_ORDER_FILTERS).default("ALL"),
  listingId: z.uuid().optional(),
});

// GET /api/v1/seller/orders?status=ALL&listingId=
export const GET = route(async (req) => {
  const { business } = await requireApprovedBusiness(req);
  const params = req.nextUrl.searchParams;
  const { status, listingId } = query.parse({
    status: params.get("status") ?? undefined,
    listingId: params.get("listingId") ?? undefined,
  });
  return ok(await listOrders(business.id, status, listingId));
});
