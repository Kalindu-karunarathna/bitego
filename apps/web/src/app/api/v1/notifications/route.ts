import { connection } from "next/server";
import { listNotificationsQuerySchema } from "@bitego/shared";
import { ok, route } from "@/lib/http";
import { requireUser } from "@/server/middleware/auth";
import { listNotifications } from "@/server/modules/notifications/notifications.service";

// GET /api/v1/notifications  (any signed-in user)
// Query params: ?page=1  ?unread=true
export const GET = route(async (req) => {
  await connection(); // never cache — notification state changes frequently

  const { user } = await requireUser(req);

  const query = listNotificationsQuerySchema.parse({
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    unread: req.nextUrl.searchParams.get("unread") ?? undefined,
  });

  const result = await listNotifications(user.id, {
    page: query.page,
    unreadOnly: query.unread === "true",
  });

  return ok(result);
});

