"use client";

import type { AuditLogDto, AuditLogPage } from "@bitego/shared";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";

const humanize = (action: string) => {
  const text = action.toLowerCase().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function details(metadata: unknown): string {
  if (metadata === null || metadata === undefined) return "";
  const text = typeof metadata === "string" ? metadata : JSON.stringify(metadata);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

export function AuditLogView() {
  const [action, setAction] = useState("");
  const [items, setItems] = useState<AuditLogDto[] | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    adminFetch<AuditLogPage>(`/admin/audit-logs?${params}`)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setActions(page.actions);
        setNextCursor(page.nextCursor);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the audit log");
      });
    return () => {
      cancelled = true;
    };
  }, [action]);

  function changeAction(value: string) {
    setItems(null);
    setError(null);
    setAction(value);
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      if (action) params.set("action", action);
      const page = await adminFetch<AuditLogPage>(`/admin/audit-logs?${params}`);
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
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="text-sm text-zinc-500">Every change an admin makes (approvals, blocks, category edits), newest first.</p>
      <div>
        <select
          value={action}
          onChange={(e) => changeAction(e.target.value)}
          aria-label="Filter by action"
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {humanize(a)}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!items && !error ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      {items && items.length === 0 ? <p className="text-sm text-zinc-500">Nothing recorded yet.</p> : null}

      {items && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="p-3 font-medium">When</th>
                <th className="p-3 font-medium">Who</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">On</th>
                <th className="p-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                  <td className="p-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="p-3">{r.actor ? r.actor.fullName : <span className="text-zinc-500">System</span>}</td>
                  <td className="p-3 font-medium">{humanize(r.action)}</td>
                  <td className="p-3 whitespace-nowrap text-zinc-500">
                    {r.entityType}
                    {r.entityId ? ` ${r.entityId.slice(0, 8)}` : ""}
                  </td>
                  <td className="p-3 break-words text-zinc-500">{details(r.metadata)}</td>
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
