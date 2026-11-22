import type { CreateReportInput } from "@bitego/shared";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// A user reports a food listing. The admin reviews it in /admin/reports. Owner: Kalindu.

export async function createReport(
  reporterId: string,
  input: CreateReportInput,
): Promise<{ id: string; status: "PENDING" }> {
  const listing = await prisma.foodListing.findUnique({
    where: { id: input.listingId },
    select: { id: true, business: { select: { ownerId: true } } },
  });
  if (!listing) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing not found");
  if (listing.business.ownerId === reporterId) {
    throw new ApiError(403, "CANNOT_REPORT_OWN_LISTING", "You cannot report your own listing");
  }

  // One open report per person per listing (the admin already has it).
  const open = await prisma.report.findFirst({
    where: { reporterId, listingId: input.listingId, status: "PENDING" },
    select: { id: true },
  });
  if (open) {
    throw new ApiError(409, "ALREADY_REPORTED", "You already reported this listing. We are reviewing it.");
  }

  const report = await prisma.report.create({
    data: {
      reporterId,
      listingId: input.listingId,
      type: input.type,
      description: input.description || null,
    },
    select: { id: true },
  });
  return { id: report.id, status: "PENDING" };
}
