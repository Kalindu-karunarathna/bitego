import { UsersView } from "@/components/admin/UsersView";

// Data is loaded in the browser after login, so this page has nothing to prefetch (dev-only check).
export const instant = false;

export default function Page() {
  return <UsersView />;
}
