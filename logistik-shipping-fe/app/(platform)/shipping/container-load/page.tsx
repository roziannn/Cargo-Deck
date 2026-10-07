import { redirect } from "next/navigation";

// The old mock list lived here; plans are now real and live under /shipping/plan.
export default function ContainerLoadPage() {
  redirect("/shipping/plan");
}
