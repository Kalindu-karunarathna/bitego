import { ok, route } from "@/lib/http";
import { requireUser } from "@/server/middleware/auth";
import { markOneRead } from "@/server/modules/notifications/notifications.service";

// PATCH /api/v1/notifications/:id/read  (any signed-in user)
// No request body needed. Marks the notification as read.
// Returns 404 if the notification does not exist or belongs to another user.
export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(req);
  const { id } = await params;

  const result = await markOneRead(user.id, id);
  return ok(result);
});

