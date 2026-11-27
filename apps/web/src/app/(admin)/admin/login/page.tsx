"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(error.code === "invalid_credentials" ? "Wrong email or password" : error.message);
        return;
      }
      router.replace("/admin/businesses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-bold text-green-700">BiteGo Admin</h1>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-green-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
