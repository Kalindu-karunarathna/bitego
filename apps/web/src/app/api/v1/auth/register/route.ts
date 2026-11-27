import { registerSchema } from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { registerAccount } from "@/server/modules/auth/auth.service";

// POST /api/v1/auth/register  (public)
export const POST = route(async (req) => {
  const input = await parseBody(req, registerSchema);
  const result = await registerAccount(input);
  return ok(result, 201);
});
