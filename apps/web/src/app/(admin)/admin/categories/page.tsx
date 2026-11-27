import { CategoriesView } from "@/components/admin/CategoriesView";

// Data is loaded in the browser after login, so this page has nothing to prefetch (dev-only check).
export const instant = false;

export default function Page() {
  return <CategoriesView />;
}
