"use client";

import {
  REPORT_STATUS_FILTERS,
  REPORT_TYPE_LABELS,
  type AdminReportDto,
  type ReportAction,
  type ReportStatusFilter,
} from "@bitego/shared";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";

const selectClass = "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  REVIEWED: "bg-blue-100 text-blue-800",
  RESOLVED: "bg-green-100 text-green-800",
  REJECTED: "bg-zinc-200 text-zinc-700",
};

const ACTION_CONFIRM: Partial<Record<ReportAction, string>> = {
  HIDE_LISTING: "Hide this listing? Customers will no longer see it and their reservations will be cancelled.",
  BLOCK_BUSINESS:
    "Block this business? The owner is logged out and cannot use BiteGo, and all its open listings are cancelled.",
};

export function ReportsView() {
  const [filter, setFilter] = useState<ReportStatusFilter>("PENDING");
  const [items, setItems] = useState<AdminReportDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    adminFetch<AdminReportDto[]>(`/admin/reports?status=${filter}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load reports");
      });
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  function changeFilter(next: ReportStatusFilter) {
    setItems(null);
    setError(null);
    setFilter(next);
  }

  async function decide(r: AdminReportDto, action: ReportAction) {
    const confirmText = ACTION_CONFIRM[action];
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(r.id);
    setError(null);
    try {
      await adminFetch(`/admin/reports/${r.id}/review`, {
        method: "POST",
        body: { action, ...(notes[r.id]?.trim() ? { note: notes[r.id].trim() } : {}) },
      });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setReloadKey((k) => k + 1);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Reports</h1>
        <select
          value={filter}
          onChange={(e) => changeFilter(e.target.value as ReportStatusFilter)}
          className={selectClass}
          aria-label="Report status"
        >
          {REPORT_STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All reports" : s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!items && !error ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      {items && items.length === 0 ? <p className="text-sm text-zinc-500">No reports here.</p> : null}

      {items?.map((r) => {
        const pending = r.status === "PENDING";
        const listingOpen = r.listing.status === "ACTIVE" || r.listing.status === "SOLD_OUT";
        const blocked = r.listing.business.status === "SUSPENDED" || r.listing.business.ownerStatus === "BLOCKED";
        return (
          <article key={r.id} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{REPORT_TYPE_LABELS[r.type]}</p>
                <p className="text-sm text-zinc-500">
                  Reported by {r.reporter.fullName} ({r.reporter.email}) on {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[r.status] ?? ""}`}>
                {r.status}
              </span>
            </div>

            {r.description ? <p className="rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-900">“{r.description}”</p> : null}

            <div className="flex gap-3 text-sm">
              {r.listing.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.listing.imageUrl} alt="" className="size-16 rounded-md object-cover" />
              ) : null}
              <div>
                <p className="font-medium">{r.listing.title}</p>
                <p className="text-zinc-500">
                  {r.listing.business.name} · listing {r.listing.status.toLowerCase().replace("_", " ")}
                  {blocked ? " · business blocked" : ""}
                </p>
                {r.listingReportCount > 1 ? (
                  <p className="text-amber-700">This listing has {r.listingReportCount} reports</p>
                ) : null}
              </div>
            </div>

            {pending ? (
              <>
                <textarea
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  maxLength={500}
                  rows={2}
                  placeholder="Note for the record (optional)"
                  className="rounded-md border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700"
                />
                <div className="flex flex-wrap gap-2 text-sm">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decide(r, "DISMISS")}
                    className="rounded-md border border-zinc-400 px-3 py-1.5 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decide(r, "RESOLVE")}
                    className="rounded-md border border-green-700 px-3 py-1.5 text-green-700 disabled:opacity-50"
                  >
                    Mark resolved
                  </button>
                  {listingOpen ? (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => decide(r, "HIDE_LISTING")}
                      className="rounded-md border border-red-600 px-3 py-1.5 text-red-600 disabled:opacity-50"
                    >
                      Hide listing
                    </button>
                  ) : null}
                  {!blocked ? (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => decide(r, "BLOCK_BUSINESS")}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-white disabled:opacity-50"
                    >
                      Block business
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                Reviewed{r.reviewedByName ? ` by ${r.reviewedByName}` : ""}
                {r.reviewedAt ? ` on ${new Date(r.reviewedAt).toLocaleString()}` : ""}
                {r.adminNote ? ` — ${r.adminNote}` : ""}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
