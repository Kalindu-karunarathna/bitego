import { connection } from "next/server";
import { updatePreferencesSchema } from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { requireUser } from "@/server/middleware/auth";
import { getPreferences, updatePreferences } from "@/server/modules/preferences/preferences.service";

// GET /api/v1/preferences  (any signed-in user)
// Returns current user's preferences, or system defaults if not set.
export const GET = route(async (req) => {
  await connection();

  const { user } = await requireUser(req);
  const result = await getPreferences(user.id);

  return ok(result);
});

// PUT /api/v1/preferences  (any signed-in user)
// Updates notification radius, enabled flag, approximate location, and preferred categories.
export const PUT = route(async (req) => {
  const { user } = await requireUser(req);
  const body = await parseBody(req, updatePreferencesSchema);
  const result = await updatePreferences(user.id, body);

  return ok(result);
});

