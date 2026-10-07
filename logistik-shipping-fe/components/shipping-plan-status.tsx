import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ShippingPlanStatus, ShippingPriority } from "@/lib/api/shipping-plan";

const STATUS_STYLE: Record<ShippingPlanStatus, string> = {
  DRAFT: "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100",
  PLANNED: "border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-100",
  APPROVED: "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  BOOKED: "border-indigo-200 bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  DISPATCHED: "border-teal-200 bg-teal-100 text-teal-700 hover:bg-teal-100",
  CANCELLED: "border-red-200 bg-red-100 text-red-700 hover:bg-red-100",
};

const PRIORITY_STYLE: Record<ShippingPriority, string> = {
  LOW: "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
  NORMAL: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50",
  HIGH: "border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-100",
  URGENT: "border-red-200 bg-red-100 text-red-700 hover:bg-red-100",
};

export function PlanStatusBadge({ status, className }: { status: ShippingPlanStatus; className?: string }) {
  return <Badge className={cn("border font-medium", STATUS_STYLE[status], className)}>{status}</Badge>;
}

export function PriorityBadge({ priority, className }: { priority: ShippingPriority; className?: string }) {
  return <Badge className={cn("border font-medium", PRIORITY_STYLE[priority], className)}>{priority}</Badge>;
}
