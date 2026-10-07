"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ShippingPlanForm } from "@/components/shipping-plan-form";
import { getStoredAuthToken } from "@/lib/api/auth";
import { getShippingPlan, updateShippingPlan, type ShippingPlanDetail } from "@/lib/api/shipping-plan";

export default function EditShippingPlanPage() {
  const { newId } = useParams<{ newId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<ShippingPlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getShippingPlan(newId, getStoredAuthToken() ?? undefined)
      .then(setPlan)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal mengambil shipping plan."));
  }, [newId]);

  const editable = plan && (plan.status === "DRAFT" || plan.status === "PLANNED");

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Edit Shipping Plan {plan?.planNo ?? ""}</h1>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {plan && !editable && <p className="text-sm text-muted-foreground">A {plan.status.toLowerCase()} plan can no longer be edited.</p>}

      {editable && (
        <ShippingPlanForm
          initial={{
            originLocationNewId: plan.originLocationNewId,
            destinationLocationNewId: plan.destinationLocationNewId,
            requestedDeliveryDate: plan.requestedDeliveryDate,
            plannedShipDate: plan.plannedShipDate,
            priority: plan.priority,
            specialHandling: plan.specialHandling,
            notes: plan.notes ?? "",
          }}
          submitLabel="Save Changes"
          cancelHref={`/shipping/plan/${newId}`}
          onSubmit={async (values) => {
            await updateShippingPlan(newId, values, getStoredAuthToken() ?? undefined);
            router.push(`/shipping/plan/${newId}`);
          }}
        />
      )}
    </div>
  );
}
