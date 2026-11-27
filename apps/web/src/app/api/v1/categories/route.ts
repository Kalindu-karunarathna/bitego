import { ok, route } from "@/lib/http";
import { listActiveCategories } from "@/server/modules/categories/categories.service";

// GET /api/v1/categories  (public)
export const GET = route(async () => ok(await listActiveCategories()));
