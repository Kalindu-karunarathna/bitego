import type { CategoryDto } from "@bitego/shared";
import { prisma } from "@/lib/prisma";

// Categories the apps may show (active ones only). The admin list with hidden categories comes later.
export async function listActiveCategories(): Promise<CategoryDto[]> {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, iconUrl: true, b2bSuitability: true },
  });
}
