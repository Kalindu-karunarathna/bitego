import { createCategorySchema } from "@bitego/shared";
import { ok, parseBody, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { createCategory, listAllCategories } from "@/server/modules/admin/categories.service";

// GET /api/v1/admin/categories   all categories including hidden ones (admin only)
export const GET = route(async (req) => {
  await requireRole(req, "ADMIN");
  return ok(await listAllCategories());
});

// POST /api/v1/admin/categories  { name, description?, b2bSuitability? }  (admin only)
export const POST = route(async (req) => {
  const { user } = await requireRole(req, "ADMIN");
  const input = await parseBody(req, createCategorySchema);
  return ok(await createCategory(user.id, input), 201);
});
