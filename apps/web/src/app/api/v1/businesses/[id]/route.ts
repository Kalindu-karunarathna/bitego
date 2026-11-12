import { z } from "zod";
import { ApiError, ok, route } from "@/lib/http";
import { getPublicBusiness } from "@/server/modules/businesses/businesses.service";

// GET /api/v1/businesses/:id  (public)
export const GET = route(async (_req, ctx: RouteContext<"/api/v1/businesses/[id]">) => {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "BUSINESS_NOT_FOUND", "Business not found");
  return ok(await getPublicBusiness(id));
});
