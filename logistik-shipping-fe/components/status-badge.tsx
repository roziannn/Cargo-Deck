"use client";

import type { ComponentProps, ComponentType } from "react";
import { CircleAlert, CircleCheck, CircleDashedIcon, HelpCircle, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

type StatusTone = {
  icon: ComponentType<{ className?: string }>;
  variant: BadgeVariant;
};

function normalizeStatus(status: string | null | undefined) {
  return (status || "").trim().toLowerCase();
}

function resolveStatusTone(status: string): StatusTone {
  const normalized = normalizeStatus(status);

  if (normalized === "publish" || normalized === "published" || normalized.includes("approve")) {
    return { icon: CircleCheck, variant: "default" };
  }

  if (
    normalized === "obsolete" ||
    normalized === "inactive" ||
    normalized.includes("reject") ||
    normalized.includes("return")
  ) {
    return { icon: XCircle, variant: "destructive" };
  }

  if (normalized === "draft" || normalized === "save draft" || normalized === "saved draft") {
    return { icon: CircleDashedIcon, variant: "warning" };
  }

  if (
    normalized === "in progress" ||
    normalized === "inprogress" ||
    normalized === "pending approval" ||
    normalized === "pendingapproval" ||
    normalized === "pending_approval" ||
    normalized === "submit" ||
    normalized === "submitted" ||
    normalized.includes("pending") ||
    normalized.includes("submit")
  ) {
    return { icon: CircleAlert, variant: "secondary" };
  }

  return { icon: HelpCircle, variant: "outline" };
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const raw = status?.trim() || "-";
  const { icon: Icon, variant } = resolveStatusTone(raw);

  return (
    <Badge variant={variant} className={className ?? "gap-1.5"}>
      <Icon className="h-3.5 w-3.5" />
      {raw}
    </Badge>
  );
}
