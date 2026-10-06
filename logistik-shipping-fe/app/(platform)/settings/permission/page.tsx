import { redirect } from "next/navigation";

export default function PermissionPageRedirect() {
  redirect("/settings/role");
}
