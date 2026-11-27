import { redirect } from "next/navigation";

export const instant = false;

export default function AdminHome() {
  redirect("/admin/businesses");
}
