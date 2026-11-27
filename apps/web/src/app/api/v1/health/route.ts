import { connection } from "next/server";
import { ApiError, ok, route } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// GET /api/v1/health  (public) - proves the API and the database connection work.
export const GET = route(async () => {
  await connection(); // never cache this response
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error("Health check: database unreachable:", err);
    throw new ApiError(503, "DATABASE_UNAVAILABLE", "The database is not reachable");
  }
  return ok({ status: "ok", database: "up", time: new Date().toISOString() });
});
