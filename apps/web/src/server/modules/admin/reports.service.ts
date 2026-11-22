import type { AdminReportDto, ReportStatusFilter, ReviewReportInput } from "@bitego/shared";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/modules/notifications/notify";

// Admin: review the reports users send about food listings. Owner: Kalindu.
// Every decision is saved in the audit log.

const include = {
  reporter: { select: { id: true, fullName: true, email: true } },
  reviewedBy: { select: { fullName: true } },
  listing: {
    select: {
      id: true,
      title: true,
      status: true,
      images: { orderBy: { displayOrder: "asc" as const }, take: 1, select: { imageUrl: true } },
      business: {
        select: { id: true, name: true, status: true, ownerId: true, owner: { select: { status: true } } },
      },
    },
  },
} satisfies Prisma.ReportInclude;
type Row = Prisma.ReportGetPayload<{ include: typeof include }>;

function toDto(r: Row, listingReportCount: number): AdminReportDto {
  return {
    id: r.id,
    type: r.type,
    description: r.description,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    adminNote: r.adminNote,
    reviewedByName: r.reviewedBy?.fullName ?? null,
    listingReportCount,
    reporter: r.reporter,
    listing: {
      id: r.listing.id,
      title: r.listing.title,
      status: r.listing.status,
      imageUrl: r.listing.images[0]?.imageUrl ?? null,
      business: {
        id: r.listing.business.id,
        name: r.listing.business.name,
        status: r.listing.business.status,
        ownerId: r.listing.business.ownerId,
        ownerStatus: r.listing.business.owner.status,
      },
    },
  };
}

async function withCounts(rows: Row[]): Promise<AdminReportDto[]> {
  const ids = [...new Set(rows.map((r) => r.listingId))];
  const grouped = ids.length
    ? await prisma.report.groupBy({ by: ["listingId"], where: { listingId: { in: ids } }, _count: { _all: true } })
    : [];
  const counts = new Map(grouped.map((g) => [g.listingId, g._count._all]));
  return rows.map((r) => toDto(r, counts.get(r.listingId) ?? 1));
}

export async function listReports(status: ReportStatusFilter): Promise<AdminReportDto[]> {
  const rows = await prisma.report.findMany({
    where: status === "ALL" ? {} : { status },
    include,
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 200,
  });
  return withCounts(rows);
}

type Tx = Prisma.TransactionClient;
type CancelledBooking = { id: string; buyerId: string; listingId: string; title: string };

// Cancels open listings and the reservations on them. Same rules as a seller cancelling a listing.
async function cancelListings(tx: Tx, listingIds: string[], reason: string): Promise<CancelledBooking[]> {
  if (listingIds.length === 0) return [];
  const open = await tx.foodListing.findMany({
    where: { id: { in: listingIds }, status: { in: ["ACTIVE", "SOLD_OUT"] } },
    select: { id: true, title: true },
  });
  if (open.length === 0) return [];
  const openIds = open.map((l) => l.id);
  await tx.foodListing.updateMany({
    where: { id: { in: openIds }, status: { in: ["ACTIVE", "SOLD_OUT"] } },
    data: { status: "CANCELLED" },
  });

  const bookings = await tx.reservation.findMany({
    where: { listingId: { in: openIds }, status: "CONFIRMED" },
    select: { id: true, buyerId: true, listingId: true, quantity: true },
  });
  if (bookings.length > 0) {
    await tx.reservation.updateMany({
      where: { id: { in: bookings.map((b) => b.id) } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    const perListing = new Map<string, number>();
    for (const b of bookings) perListing.set(b.listingId, (perListing.get(b.listingId) ?? 0) + b.quantity);
    for (const [listingId, qty] of perListing) {
      await tx.foodListing.update({ where: { id: listingId }, data: { quantityAvailable: { increment: qty } } });
    }
  }
  const titles = new Map(open.map((l) => [l.id, l.title]));
  return bookings.map((b) => ({
    id: b.id,
    buyerId: b.buyerId,
    listingId: b.listingId,
    title: titles.get(b.listingId) ?? "your listing",
  }));
}

export async function reviewReport(reportId: string, adminId: string, input: ReviewReportInput): Promise<AdminReportDto> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      listingId: true,
      listing: { select: { businessId: true, business: { select: { ownerId: true } } } },
    },
  });
  if (!report) throw new ApiError(404, "REPORT_NOT_FOUND", "Report not found");

  const { action } = input;
  const note = input.note || null;
  const finalStatus = action === "DISMISS" ? "REJECTED" : "RESOLVED";
  const ownerId = report.listing.business.ownerId;
  if (action === "BLOCK_BUSINESS" && ownerId === adminId) {
    throw new ApiError(409, "CANNOT_CHANGE_SELF", "You cannot block your own account");
  }
  const reason = "Removed by BiteGo after a report";

  const cancelled = await prisma.$transaction(async (tx) => {
    // Only a PENDING report can be decided, and only once, even if two admins click at the same time.
    const claimed = await tx.report.updateMany({
      where: { id: reportId, status: "PENDING" },
      data: { status: finalStatus, reviewedById: adminId, adminNote: note, reviewedAt: new Date() },
    });
    if (claimed.count === 0) throw new ApiError(409, "REPORT_ALREADY_HANDLED", "This report was already reviewed");

    let bookings: CancelledBooking[] = [];
    let affectedListingIds: string[] = [report.listingId];

    if (action === "HIDE_LISTING") {
      bookings = await cancelListings(tx, [report.listingId], reason);
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: "LISTING_HIDDEN_BY_ADMIN",
          entityType: "Listing",
          entityId: report.listingId,
          metadata: { reportId, reservationsCancelled: bookings.length },
        },
      });
    }

    if (action === "BLOCK_BUSINESS") {
      const businessId = report.listing.businessId;
      const listings = await tx.foodListing.findMany({ where: { businessId }, select: { id: true } });
      affectedListingIds = listings.map((l) => l.id);
      bookings = await cancelListings(tx, affectedListingIds, reason);
      await tx.business.update({ where: { id: businessId }, data: { status: "SUSPENDED" } });
      const owner = await tx.user.findUniqueOrThrow({ where: { id: ownerId }, select: { role: true } });
      if (owner.role === "ADMIN") throw new ApiError(403, "ADMIN_PROTECTED", "Admin accounts cannot be blocked here");
      await tx.user.update({ where: { id: ownerId }, data: { status: "BLOCKED" } });
      await tx.auditLog.createMany({
        data: [
          {
            actorId: adminId,
            action: "BUSINESS_SUSPENDED",
            entityType: "Business",
            entityId: businessId,
            metadata: { reportId, reservationsCancelled: bookings.length },
          },
          { actorId: adminId, action: "USER_BLOCKED", entityType: "User", entityId: ownerId, metadata: { reportId } },
        ],
      });
    }

    // Other open reports about the same thing are closed together with this one.
    if (action === "HIDE_LISTING" || action === "BLOCK_BUSINESS") {
      await tx.report.updateMany({
        where: { listingId: { in: affectedListingIds }, status: "PENDING", id: { not: reportId } },
        data: {
          status: "RESOLVED",
          reviewedById: adminId,
          reviewedAt: new Date(),
          adminNote: `Closed together with another report (${action === "HIDE_LISTING" ? "listing hidden" : "business blocked"})`,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: action === "DISMISS" ? "REPORT_DISMISSED" : "REPORT_RESOLVED",
        entityType: "Report",
        entityId: reportId,
        metadata: { action, listingId: report.listingId, ...(note ? { note } : {}) },
      },
    });
    return bookings;
  });

  // A failed notification must never undo the decision.
  await Promise.all(
    cancelled.map((b) =>
      notify({
        userId: b.buyerId,
        type: "RESERVATION_CANCELLED",
        title: "Your reservation was cancelled",
        message: `${b.title} was removed by BiteGo. Your reservation is cancelled.`,
        listingId: b.listingId,
        reservationId: b.id,
      }).catch((err) => console.error("notify failed after report action:", err)),
    ),
  );

  const row = await prisma.report.findUniqueOrThrow({ where: { id: reportId }, include });
  return (await withCounts([row]))[0];
}
