import { BusinessesView } from "@/components/admin/BusinessesView";

// Data is loaded in the browser after login, so this page has nothing to prefetch (dev-only check).
export const instant = false;

export default function BusinessesPage() {
  return <BusinessesView />;
}
