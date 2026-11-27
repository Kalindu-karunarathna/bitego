"use client";

import { ROLES, USER_STATUSES, type AdminUserDto } from "@bitego/shared";
import { useEffect, useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/admin-api";

type Filters = { role: string; status: string; q: string };

const selectClass = "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

export function UsersView() {
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState<Filters>({ role: "", status: "", q: "" });
  const [items, setItems] = useState<AdminUserDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (applied.role) params.set("role", applied.role);
    if (applied.status) params.set("status", applied.status);
    if (applied.q) params.set("q", applied.q);
    adminFetch<AdminUserDto[]>(`/admin/users?${params}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load users");
      });
    return () => {
      cancelled = true;
    };
  }, [applied, reloadKey]);

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    setItems(null);
    setError(null);
    setApplied({ role, status, q: search.trim() });
  }

  async function changeStatus(u: AdminUserDto, next: "ACTIVE" | "BLOCKED") {
    if (next === "BLOCKED" && !window.confirm(`Block ${u.fullName}? They will be logged out and cannot use BiteGo.`)) return;
    setBusyId(u.id);
    setError(null);
    try {
      await adminFetch(`/admin/users/${u.id}/status`, { method: "POST", body: { status: next } });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <form onSubmit={applyFilters} className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className={`${selectClass} min-w-56 flex-1`}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass} aria-label="Role">
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Status">
          <option value="">All statuses</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!items && !error ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      {items && items.length === 0 ? <p className="text-sm text-zinc-500">No users found.</p> : null}

      {items && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Role</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Registered</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="p-3">
                    <p className="font-medium">{u.fullName}</p>
                    <p className="text-zinc-500">{u.email}</p>
                    {u.businessName ? <p className="text-zinc-500">Business: {u.businessName}</p> : null}
                  </td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${u.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    {u.role === "ADMIN" ? null : u.status === "BLOCKED" ? (
                      <button
                        disabled={busyId === u.id}
                        onClick={() => changeStatus(u, "ACTIVE")}
                        className="rounded-md border border-green-700 px-3 py-1.5 text-green-700 disabled:opacity-50"
                      >
                        Unblock
                      </button>
                    ) : (
                      <button
                        disabled={busyId === u.id}
                        onClick={() => changeStatus(u, "BLOCKED")}
                        className="rounded-md border border-red-600 px-3 py-1.5 text-red-600 disabled:opacity-50"
                      >
                        Block
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
