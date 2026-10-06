import { redirect } from "next/navigation";

export default function PermissionCreatePageRedirect() {
  redirect("/settings/role/create");
}
