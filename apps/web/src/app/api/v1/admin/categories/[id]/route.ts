import { updateCategorySchema } from "@bitego/shared";
import { z } from "zod";
import { ApiError, ok, parseBody, route } from "@/lib/http";
import { requireRole } from "@/server/middleware/auth";
import { updateCategory } from "@/server/modules/admin/categories.service";

// PATCH /api/v1/admin/categories/:id  { name?, description?, b2bSuitability?, isActive? }  (admin only)
export const PATCH = route(async (req, ctx: RouteContext<"/api/v1/admin/categories/[id]">) => {
  const { user } = await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found");
  const input = await parseBody(req, updateCategorySchema);
  return ok(await updateCategory(user.id, id, input), 200);
});
