import { connection } from "next/server";
import {
  registerPushTokenSchema,
  removePushTokenSchema,
  type RemovePushTokenInput,
} from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { requireUser } from "@/server/middleware/auth";
import {
  upsertDeviceToken,
  removeDeviceToken,
} from "@/server/modules/notifications/push.service";

// POST /api/v1/notifications/push-token
// Registers or updates an Expo device push token for the authenticated user.
export const POST = route(async (req) => {
  await connection();
  const { user } = await requireUser(req);
  const body = await parseBody(req, registerPushTokenSchema);

  const result = await upsertDeviceToken(user.id, body);
  return ok(result);
});

// DELETE /api/v1/notifications/push-token
// Deregisters a device push token upon logout.
// Accepts the token either in the JSON request body or as a ?token= query parameter.
export const DELETE = route(async (req) => {
  await connection();
  const { user } = await requireUser(req);

  const queryToken = req.nextUrl.searchParams.get("token");
  let input: RemovePushTokenInput;
  if (queryToken) {
    input = removePushTokenSchema.parse({ token: queryToken });
  } else {
    input = await parseBody(req, removePushTokenSchema);
  }

  const result = await removeDeviceToken(user.id, input);
  return ok(result);
});

