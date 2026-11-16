import { ok, route } from "@/lib/http";
import { requireUser } from "@/server/middleware/auth";
import { markAllRead } from "@/server/modules/notifications/notifications.service";

// POST /api/v1/notifications/mark-all-read  (any signed-in user)
// No request body needed. Marks every unread notification as read.
export const POST = route(async (req) => {
  const { user } = await requireUser(req);

  const result = await markAllRead(user.id);
  return ok(result);
});

