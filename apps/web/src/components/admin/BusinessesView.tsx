"use client";

import { BUSINESS_STATUS_FILTERS, type AdminBusinessDto, type BusinessStatusFilter } from "@bitego/shared";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";

const LABEL: Record<BusinessStatusFilter, string> = {
  PENDING: "Pending",
  ACTIVE: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
  ALL: "All",
};

export function BusinessesView() {
  const [filter, setFilter] = useState<BusinessStatusFilter>("PENDING");
  const [items, setItems] = useState<AdminBusinessDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminFetch<AdminBusinessDto[]>(`/admin/businesses?status=${filter}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load businesses");
      });
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  function changeFilter(s: BusinessStatusFilter) {
    setItems(null);
    setError(null);
    setFilter(s);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Businesses</h1>
      <div className="flex flex-wrap gap-2">
        {BUSINESS_STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => changeFilter(s)}
            className={`rounded-full border px-4 py-1.5 text-sm ${filter === s ? "border-green-700 bg-green-700 text-white" : "border-zinc-300 dark:border-zinc-700"}`}
          >
            {LABEL[s]}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!items && !error ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      {items && items.length === 0 ? <p className="text-sm text-zinc-500">No businesses here.</p> : null}
      {items?.map((b) => <BusinessCard key={b.id} business={b} onChanged={() => setReloadKey((k) => k + 1)} />)}
    </div>
  );
}

function BusinessCard({ business: b, onChanged }: { business: AdminBusinessDto; onChanged: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: "approve" | "reject", body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/admin/businesses/${b.id}/${path}`, { method: "POST", body });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const canApprove = b.status === "PENDING" || b.status === "REJECTED";
  const canReject = b.status === "PENDING";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{b.name}</h2>
          <p className="text-sm text-zinc-500">{b.type}</p>
        </div>
        <StatusBadge status={b.status} />
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <Row label="Owner" value={`${b.owner.fullName} (${b.owner.email})`} />
        <Row label="Owner phone" value={b.owner.phone ?? "-"} />
        <Row label="Business phone" value={b.contactNo} />
        <Row label="Registration no." value={b.registrationNo ?? "-"} />
        <Row label="Address" value={`${b.addressLine}, ${b.city}${b.district ? `, ${b.district}` : ""}`} />
        <Row label="Registered" value={new Date(b.createdAt).toLocaleString()} />
      </dl>
      {b.description ? <p className="text-sm">{b.description}</p> : null}
      <a
        href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-green-700 underline"
      >
        View shop location on the map ({b.latitude.toFixed(5)}, {b.longitude.toFixed(5)})
      </a>
      {b.verification?.remarks ? (
        <p className="rounded-md bg-zinc-100 p-2 text-sm dark:bg-zinc-900">Admin remarks: {b.verification.remarks}</p>
      ) : null}

      {rejecting ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Reason for rejecting (the business will see this)"
            rows={3}
            className="rounded-md border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700"
          />
          <div className="flex gap-2">
            <button
              disabled={busy || remarks.trim().length < 3}
              onClick={() => act("reject", { remarks })}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button onClick={() => setRejecting(false)} className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {canApprove ? (
            <button
              disabled={busy}
              onClick={() => act("approve")}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Approve
            </button>
          ) : null}
          {canReject ? (
            <button
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
            >
              Reject
            </button>
          ) : null}
        </div>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500">{label}:</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminBusinessDto["status"] }) {
  const color =
    status === "ACTIVE"
      ? "bg-green-100 text-green-800"
      : status === "PENDING"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{status}</span>;
}
