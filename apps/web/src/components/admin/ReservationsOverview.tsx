"use client";

import {
  RESERVATION_STATUS_FILTERS,
  type AdminReservationDto,
  type AdminReservationPage,
  type ReservationStatusFilter,
} from "@bitego/shared";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";

const LABEL: Record<ReservationStatusFilter, string> = {
  ALL: "All",
  CONFIRMED: "Confirmed",
  PICKED_UP: "Picked up",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const BADGE: Record<string, string> = {
  CONFIRMED: "bg-blue-100 text-blue-800",
  PICKED_UP: "bg-green-100 text-green-800",
  CANCELLED: "bg-zinc-200 text-zinc-700",
  EXPIRED: "bg-amber-100 text-amber-800",
};

const money = (n: number) => `Rs. ${n.toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;

function outcome(r: AdminReservationDto): string {
  if (r.status === "PICKED_UP" && r.pickedUpAt) return `Picked up ${new Date(r.pickedUpAt).toLocaleString()}`;
  if (r.status === "CANCELLED") {
    const when = r.cancelledAt ? new Date(r.cancelledAt).toLocaleString() : "";
    return `Cancelled ${when}${r.cancelReason ? ` · ${r.cancelReason}` : ""}`.trim();
  }
  if (r.status === "EXPIRED") return "Not collected in time";
  return "Waiting for pickup";
}

export function ReservationsOverview() {
  const [status, setStatus] = useState<ReservationStatusFilter>("ALL");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<AdminReservationDto[] | null>(null);
  const [counts, setCounts] = useState<AdminReservationPage["counts"] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ status });
    if (search) params.set("search", search);
    adminFetch<AdminReservationPage>(`/admin/reservations?${params}`)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCounts(page.counts);
        setNextCursor(page.nextCursor);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load reservations");
      });
    return () => {
      cancelled = true;
    };
  }, [status, search]);

  function changeStatus(next: ReservationStatusFilter) {
    setItems(null);
    setError(null);
    setStatus(next);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setItems(null);
    setError(null);
    setSearch(typed.trim());
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ status, cursor: nextCursor });
      if (search) params.set("search", search);
      const page = await adminFetch<AdminReservationPage>(`/admin/reservations?${params}`);
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Reservations</h1>
      <p className="text-sm text-zinc-500">Every reservation on BiteGo, newest first. Read-only, for checking disputes.</p>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Reservation status">
        {RESERVATION_STATUS_FILTERS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => changeStatus(s)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              status === s
                ? "border-green-700 bg-green-700 text-white"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {LABEL[s]}
            {counts ? <span className="ml-1.5 opacity-80">{counts[s]}</span> : null}
          </button>
        ))}
      </div>

      <form onSubmit={submitSearch} className="flex gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Search pickup code, buyer, listing or business"
          maxLength={80}
          aria-label="Search reservations"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button className="rounded-md border border-zinc-400 px-4 py-2 text-sm">Search</button>
        {search ? (
          <button
            type="button"
            onClick={() => {
              setTyped("");
              setItems(null);
              setSearch("");
            }}
            className="rounded-md px-3 py-2 text-sm text-zinc-500 underline"
          >
            Clear
          </button>
        ) : null}
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!items && !error ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      {items && items.length === 0 ? <p className="text-sm text-zinc-500">No reservations match.</p> : null}

      {items && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="p-3 font-medium">Reserved</th>
                <th className="p-3 font-medium">Buyer</th>
                <th className="p-3 font-medium">Listing</th>
                <th className="p-3 font-medium">Qty · Total</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Code</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                  <td className="p-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="p-3">
                    <p className="font-medium">{r.buyer.fullName}</p>
                    <p className="text-zinc-500">{r.buyer.email}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{r.listing.title}</p>
                    <p className="text-zinc-500">{r.listing.business.name}</p>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {r.quantity} · {money(r.totalPrice)}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGE[r.status] ?? ""}`}>
                      {LABEL[r.status]}
                    </span>
                    <p className="mt-1 text-xs text-zinc-500">{outcome(r)}</p>
                  </td>
                  <td className="p-3 font-mono">{r.pickupCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {nextCursor ? (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
