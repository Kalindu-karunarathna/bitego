import { z } from "zod";

// Server environment variables, checked once on first use (not at import time,
// so `next build` and `npm run typecheck` work without a .env file).
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  // Supabase "secret" key (formerly service_role). Server only. Never put it in the mobile app.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

let cached: z.infer<typeof schema> | undefined;

export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid or missing environment variables: ${missing}. Check apps/web/.env`);
    }
    cached = parsed.data;
  }
  return cached;
}
