"use client";

import { useRouter } from "next/navigation";

import { ShippingPlanForm } from "@/components/shipping-plan-form";
import { getStoredAuthToken } from "@/lib/api/auth";
import { createShippingPlan } from "@/lib/api/shipping-plan";
import { useI18n } from "@/lib/i18n/provider";

export default function CreateShippingPlanPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("New Shipping Plan")}</h1>
        <p className="text-sm text-muted-foreground">{t("Step 1 of 2 — shipment details. Next you arrange the cargo in the load simulation.")}</p>
      </div>

      <ShippingPlanForm
        submitLabel={t("Save & Continue to Load Simulation")}
        cancelHref="/shipping/plan"
        onSubmit={async (values) => {
          const plan = await createShippingPlan(values, getStoredAuthToken() ?? undefined);
          router.push(`/shipping/container-load/create?planId=${encodeURIComponent(plan.newId)}`);
        }}
      />
    </div>
  );
}
