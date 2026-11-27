"use client";

import { ANALYTICS_RANGES, type AdminAnalyticsDto, type AnalyticsRange } from "@bitego/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { ReservationsChart, VIZ_CSS } from "@/components/admin/ReservationsChart";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function AnalyticsView() {
  const [range, setRange] = useState<AnalyticsRange>(30);
  const [data, setData] = useState<AdminAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminFetch<AdminAnalyticsDto>(`/admin/analytics?days=${range}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load analytics");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  function changeRange(r: AnalyticsRange) {
    setLoading(true); // keep the old numbers on screen (dimmed) while the new range loads
    setRange(r);
  }

  const noReservations = data !== null && data.reservations.total === 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <style>{VIZ_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-2" role="group" aria-label="Date range">
          {ANALYTICS_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => changeRange(r)}
              aria-pressed={range === r}
              className={`rounded-full border px-4 py-1.5 text-sm ${range === r ? "border-green-700 bg-green-700 text-white" : "border-zinc-300 dark:border-zinc-700"}`}
            >
              Last {r} days
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!data && !error ? <p className="text-sm text-zinc-500">Loading…</p> : null}

      {data ? (
        <div className={`flex flex-col gap-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <section className="viz-root rounded-lg border p-5" style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Food rescued in the last {data.rangeDays} days
            </p>
            <p className="text-5xl font-bold tracking-tight">{fmt(data.impact.itemsRescued)}</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              items picked up, in {fmt(data.impact.completedPickups)} completed pickups
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Reservations" value={fmt(data.reservations.total)} note={`${fmt(data.reservations.confirmed)} waiting for pickup`} />
            <Tile label="Revenue recovered" value={`Rs. ${fmt(data.impact.revenueRecovered)}`} note="paid at pickup" />
            <Tile label="Cancelled or expired" value={fmt(data.reservations.cancelled + data.reservations.expired)} note={`${fmt(data.reservations.cancelled)} cancelled, ${fmt(data.reservations.expired)} expired`} />
            <Tile label="Active listings" value={fmt(data.listings.active)} note={`${fmt(data.listings.soldOut)} sold out now`} />
          </div>

          {noReservations ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No reservations in this period yet. The chart appears when customers start reserving food.
            </p>
          ) : (
            <ReservationsChart daily={data.daily} />
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="mb-3 font-semibold">Top businesses</h2>
              {data.topBusinesses.length === 0 ? (
                <p className="text-sm text-zinc-500">No completed pickups in this period.</p>
              ) : (
                <ol className="flex flex-col gap-2 text-sm">
                  {data.topBusinesses.map((b, i) => (
                    <li key={b.businessId} className="flex items-center justify-between gap-3">
                      <span>
                        {i + 1}. <span className="font-medium">{b.name}</span> <span className="text-zinc-500">({b.city})</span>
                      </span>
                      <span className="whitespace-nowrap">
                        {fmt(b.itemsRescued)} items, {fmt(b.pickups)} pickups
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="mb-3 font-semibold">Right now</h2>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-zinc-500">Customers</dt>
                <dd>{fmt(data.users.customers)}</dd>
                <dt className="text-zinc-500">Businesses (users)</dt>
                <dd>{fmt(data.users.businesses)}</dd>
                <dt className="text-zinc-500">Approved businesses</dt>
                <dd>{fmt(data.businesses.active)}</dd>
                <dt className="text-zinc-500">Waiting for approval</dt>
                <dd>
                  {data.businesses.pending > 0 ? (
                    <Link href="/admin/businesses" className="font-semibold text-green-700 underline">
                      {fmt(data.businesses.pending)} to review
                    </Link>
                  ) : (
                    "0"
                  )}
                </dd>
                <dt className="text-zinc-500">Rejected or suspended</dt>
                <dd>{fmt(data.businesses.rejected + data.businesses.suspended)}</dd>
              </dl>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="viz-root rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {note}
      </p>
    </div>
  );
}
