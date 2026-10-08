"use client";

import { Badge } from "@/components/ui/badge";
import { INCIDENT_STATUS_LABEL, type IncidentStatus } from "@/lib/api/shipping-incident";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<IncidentStatus, string> = {
  OPEN: "border-red-200 bg-red-100 text-red-700 hover:bg-red-100",
  IN_PROGRESS: "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100",
  CLAIM_FILED: "border-violet-200 bg-violet-100 text-violet-700 hover:bg-violet-100",
  RESOLVED: "border-green-200 bg-green-100 text-green-700 hover:bg-green-100",
  REJECTED: "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const { t } = useI18n();
  return <Badge className={cn("border font-medium", STATUS_STYLE[status])}>{t(INCIDENT_STATUS_LABEL[status])}</Badge>;
}
