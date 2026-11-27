import type { ReactNode } from "react";
import { AdminGate } from "@/components/admin/AdminGate";

// The admin dashboard loads its data in the browser after the admin logs in, so none of it can be prefetched.
// This turns off Next.js's instant-navigation check (a development hint) for everything under /admin.
export const instant = false;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
