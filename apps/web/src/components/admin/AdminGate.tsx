"use client";

import type { MeResponse } from "@bitego/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminApiError, adminFetch } from "@/lib/admin-api";
import { supabaseBrowser } from "@/lib/supabase-browser";

// Wraps every /admin page. Only a signed-in ADMIN sees the pages; everyone else goes to the login page.
// (The real protection is on the server: every /api/v1/admin route checks the role again.)

type Gate = { state: "checking" } | { state: "ok"; me: MeResponse } | { state: "denied"; message: string };

const NAV = [{ href: "/admin/businesses", label: "Businesses" }];

export function AdminGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [gate, setGate] = useState<Gate>({ state: "checking" });
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await adminFetch<MeResponse>("/auth/me");
        if (cancelled) return;
        if (me.role !== "ADMIN") return setGate({ state: "denied", message: "This account is not an admin." });
        setGate({ state: "ok", me });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AdminApiError && e.code === "UNAUTHENTICATED") return router.replace("/admin/login");
        setGate({ state: "denied", message: e instanceof Error ? e.message : "Could not check your account" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLogin, pathname, router]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/admin/login");
  }

  if (isLogin) return <>{children}</>;

  if (gate.state === "checking") {
    return <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Loading…</div>;
  }

  if (gate.state === "denied") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-zinc-500">{gate.message}</p>
        <button onClick={signOut} className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex items-center justify-between gap-4 border-b border-zinc-200 p-4 md:w-56 md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-r dark:border-zinc-800">
        <div>
          <p className="text-lg font-bold text-green-700">BiteGo Admin</p>
          <p className="hidden truncate text-xs text-zinc-500 md:block">{gate.me.email}</p>
        </div>
        <nav className="flex gap-2 md:flex-col">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-md px-3 py-2 text-sm ${pathname.startsWith(n.href) ? "bg-green-700 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <button onClick={signOut} className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:mt-auto dark:border-zinc-700">
          Log out
        </button>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
