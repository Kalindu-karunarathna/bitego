import { ok, route } from "@/lib/http";
import { requireUser } from "@/server/middleware/auth";
import { getProfile } from "@/server/modules/auth/auth.service";

// GET /api/v1/auth/me  (any signed-in user)
export const GET = route(async (req) => {
  const { user, business } = await requireUser(req);
  return ok(await getProfile(user, business));
});
