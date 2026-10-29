import { connection, type NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/http";
import { runExpiryJob } from "@/server/modules/jobs/expiry.job";

// Owner: Sachira. Scheduled job endpoint to expire listings and reservations past pickup deadline.
// Secured with CRON_SECRET (via Bearer token or x-cron-secret header).

function verifyCronAuth(req: NextRequest): void {
  const secret = process.env.CRON_SECRET;
  // If no secret is configured in development, allow access for testing.
  if (!secret) return;

  const authHeader = req.headers.get("authorization");
  const customHeader = req.headers.get("x-cron-secret");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (token !== secret && customHeader !== secret) {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid or missing cron secret");
  }
}

export const GET = route(async (req: NextRequest) => {
  await connection();
  verifyCronAuth(req);

  const result = await runExpiryJob();
  return ok(result);
});

export const POST = route(async (req: NextRequest) => {
  await connection();
  verifyCronAuth(req);

  const result = await runExpiryJob();
  return ok(result);
});

