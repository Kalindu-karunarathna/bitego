"use client";

import { B2B_SUITABILITIES, type AdminCategoryDto, type B2BSuitabilityName } from "@bitego/shared";
import { useEffect, useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/admin-api";

const inputClass = "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

const SUITABILITY_HELP: Record<B2BSuitabilityName, string> = {
  SUITABLE: "Can be sold to customers and to businesses",
  RESTRICTED: "Customers only (for example cooked meals)",
  UNSUITABLE: "Not allowed for business listings",
};

export function CategoriesView() {
  const [items, setItems] = useState<AdminCategoryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminFetch<AdminCategoryDto[]>("/admin/categories")
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load categories");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Categories</h1>
      <p className="text-sm text-zinc-500">
        Businesses choose from the visible categories when they post food. A listing meant only for businesses needs a
        &quot;Suitable&quot; category.
      </p>
      <AddCategory onAdded={reload} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!items && !error ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      {items?.map((c) => <CategoryRow key={c.id} category={c} onChanged={reload} />)}
    </div>
  );
}

function AddCategory({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [suitability, setSuitability] = useState<B2BSuitabilityName>("SUITABLE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminFetch("/admin/categories", {
        method: "POST",
        body: { name, description: description || undefined, b2bSuitability: suitability },
      });
      setName("");
      setDescription("");
      setSuitability("SUITABLE");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-semibold">Add a category</h2>
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required className={`${inputClass} min-w-40 flex-1`} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className={`${inputClass} min-w-48 flex-[2]`} />
        <select value={suitability} onChange={(e) => setSuitability(e.target.value as B2BSuitabilityName)} className={inputClass} aria-label="Business suitability">
          {B2B_SUITABILITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy} className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Add
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function CategoryRow({ category: c, onChanged }: { category: AdminCategoryDto; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description ?? "");
  const [suitability, setSuitability] = useState<B2BSuitabilityName>(c.b2bSuitability);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/admin/categories/${c.id}`, { method: "PATCH", body });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 ${c.isActive ? "" : "opacity-60"}`}>
      {editing ? (
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} min-w-40 flex-1`} aria-label="Name" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} min-w-48 flex-[2]`} aria-label="Description" />
          <select value={suitability} onChange={(e) => setSuitability(e.target.value as B2BSuitabilityName)} className={inputClass} aria-label="Business suitability">
            {B2B_SUITABILITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button disabled={busy} onClick={() => patch({ name, description, b2bSuitability: suitability })} className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">
              {c.name} {c.isActive ? null : <span className="text-sm font-normal text-zinc-500">(hidden)</span>}
            </h2>
            {c.description ? <p className="text-sm text-zinc-500">{c.description}</p> : null}
            <p className="text-sm">
              <span className="font-medium">{c.b2bSuitability}</span>: {SUITABILITY_HELP[c.b2bSuitability]}. Used by {c.listingCount} listing{c.listingCount === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
              Edit
            </button>
            <button
              disabled={busy}
              onClick={() => patch({ isActive: !c.isActive })}
              className={`rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 ${c.isActive ? "border-red-600 text-red-600" : "border-green-700 text-green-700"}`}
            >
              {c.isActive ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
