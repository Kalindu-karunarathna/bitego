import type { AdminCategoryDto, CreateCategoryInput, UpdateCategoryInput } from "@bitego/shared";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Admin: manage the food categories businesses choose from.
// Hiding a category (isActive=false) removes it from the app lists; existing listings keep working.

const include = { _count: { select: { listings: true } } } satisfies Prisma.CategoryInclude;
type Row = Prisma.CategoryGetPayload<{ include: typeof include }>;

function toDto(c: Row): AdminCategoryDto {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    b2bSuitability: c.b2bSuitability,
    isActive: c.isActive,
    listingCount: c._count.listings,
  };
}

async function assertNameFree(name: string, exceptId?: string) {
  const clash = await prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new ApiError(409, "NAME_TAKEN", "A category with this name already exists");
}

export async function listAllCategories(): Promise<AdminCategoryDto[]> {
  const rows = await prisma.category.findMany({ include, orderBy: { name: "asc" } });
  return rows.map(toDto);
}

export async function createCategory(adminId: string, input: CreateCategoryInput): Promise<AdminCategoryDto> {
  await assertNameFree(input.name);
  const created = await prisma.category.create({
    data: { name: input.name, description: input.description || null, b2bSuitability: input.b2bSuitability },
    include,
  });
  await prisma.auditLog.create({
    data: { actorId: adminId, action: "CATEGORY_CREATED", entityType: "Category", entityId: created.id, metadata: { name: created.name } },
  });
  return toDto(created);
}

export async function updateCategory(adminId: string, id: string, input: UpdateCategoryInput): Promise<AdminCategoryDto> {
  const existing = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found");
  if (input.name !== undefined) await assertNameFree(input.name, id);

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.b2bSuitability !== undefined ? { b2bSuitability: input.b2bSuitability } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include,
  });
  await prisma.auditLog.create({
    data: { actorId: adminId, action: "CATEGORY_UPDATED", entityType: "Category", entityId: id, metadata: input },
  });
  return toDto(updated);
}
