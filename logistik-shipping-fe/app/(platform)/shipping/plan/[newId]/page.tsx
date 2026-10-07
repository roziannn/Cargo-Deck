"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, Check } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { PlanStatusBadge, PriorityBadge } from "@/components/shipping-plan-status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import {
  changeShippingPlanStatus,
  formatPlanDate,
  formatPlanDateTime,
  getShippingPlan,
  type ShippingPlanDetail,
  type ShippingPlanStatus,
} from "@/lib/api/shipping-plan";
import { cn } from "@/lib/utils";

const STEPS: { status: ShippingPlanStatus; label: string }[] = [
  { status: "DRAFT", label: "Draft" },
  { status: "PLANNED", label: "Load planned" },
  { status: "APPROVED", label: "Approved" },
];

const HANDLING_LABEL: Record<string, string> = { COLD_CHAIN: "Cold chain", FRAGILE: "Fragile", HAZARDOUS: "Hazardous" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default function ShippingPlanDetailPage() {
  const { newId } = useParams<{ newId: string }>();
  const [plan, setPlan] = useState<ShippingPlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setPlan(await getShippingPlan(newId, getStoredAuthToken() ?? undefined));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengambil shipping plan.");
    }
  }, [newId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function runAction(action: "approve" | "cancel", note?: string) {
    setIsBusy(true);
    try {
      setPlan(await changeShippingPlanStatus(newId, action, note, getStoredAuthToken() ?? undefined));
      toast.success(action === "approve" ? "Plan approved." : "Plan cancelled.");
      setOpenCancel(false);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aksi gagal.");
      await load();
    } finally {
      setIsBusy(false);
    }
  }

  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (!plan) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  const editable = plan.status === "DRAFT" || plan.status === "PLANNED";
  const weight = Number(plan.totalWeightKg);
  const payload = plan.vehicleMaxPayload ? Number(plan.vehicleMaxPayload) : null;
  const overweight = payload !== null && weight > payload;
  const stepIndex = STEPS.findIndex((s) => s.status === plan.status);

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Link href="/shipping/plan" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to plans
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{plan.planNo}</h1>
            <PlanStatusBadge status={plan.status} />
            <PriorityBadge priority={plan.priority} />
          </div>
          <p className="text-sm text-muted-foreground">
            {plan.originName} → {plan.destinationName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/shipping/plan/${plan.newId}/edit`}>Edit Details</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/shipping/container-load/create?planId=${plan.newId}`}>{plan.status === "DRAFT" ? "Start Load Simulation" : "Open Load Simulation"}</Link>
              </Button>
            </>
          )}
          {plan.status === "PLANNED" && (
            <Button onClick={() => void runAction("approve")} disabled={isBusy}>
              <Check className="mr-2 h-4 w-4" /> Approve
            </Button>
          )}
          {plan.status !== "CANCELLED" && (
            <Button variant="outline" className="text-destructive" onClick={() => setOpenCancel(true)} disabled={isBusy}>
              Cancel Plan
            </Button>
          )}
        </div>
      </div>

      {plan.status !== "CANCELLED" && (
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {STEPS.map((step, index) => (
            <li key={step.status} className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-3 py-1",
                  index <= stepIndex ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-dashed text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-6 rounded-lg border p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Planned ship date">{formatPlanDate(plan.plannedShipDate)}</Field>
        <Field label="Requested delivery">{formatPlanDate(plan.requestedDeliveryDate)}</Field>
        <Field label="Special handling">{plan.specialHandling ? HANDLING_LABEL[plan.specialHandling] : "-"}</Field>
        <Field label="Created by">
          {plan.createdBy || "-"} · {formatPlanDateTime(plan.createdDate)}
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <Field label="Notes">{plan.notes || "-"}</Field>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Load</h2>
        {plan.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No load simulation saved yet. Use “Start Load Simulation” to choose a vehicle and arrange the cargo.</p>
        ) : (
          <>
            <div className="grid gap-6 rounded-lg border p-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Vehicle">{plan.vehicleName || "-"}</Field>
              <Field label="Volume used">{plan.utilizationPct ? `${plan.utilizationPct}%` : "-"}</Field>
              <Field label="Total units">{plan.totalUnits}</Field>
              <Field label="Total weight">
                <span className={cn(overweight && "font-semibold text-destructive")}>
                  {plan.totalWeightKg} kg{payload !== null ? ` / ${payload} kg` : ""}
                </span>
              </Field>
            </div>

            {overweight && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Total weight exceeds the vehicle&apos;s max payload. Choose a bigger vehicle or reduce the load before approving.
              </div>
            )}
            {payload === null && (
              <p className="text-xs text-muted-foreground">This vehicle has no max payload set, so the weight limit is not checked. Set it in Master Vehicle.</p>
            )}

            <div className="overflow-hidden rounded-lg border">
              <Table containerClassName="rounded-none border-0 bg-transparent">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Unit weight (kg)</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.items.map((item) => (
                    <TableRow key={item.cubstoolNewId}>
                      <TableCell className="font-medium">{item.itemCode}</TableCell>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell className="text-right">{item.unitWeightKg ?? "-"}</TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
                      <TableCell className="text-right">{item.unitWeightKg ? +(Number(item.unitWeightKg) * item.qty).toFixed(2) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">History</h2>
        <ol className="space-y-3 border-l pl-4">
          {[...plan.history].reverse().map((h, index) => (
            <li key={index} className="space-y-0.5">
              <div className="text-sm font-medium">
                {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
              </div>
              {h.note && <div className="text-sm text-muted-foreground">{h.note}</div>}
              <div className="text-xs text-muted-foreground">
                {h.changedBy || "-"} · {formatPlanDateTime(h.changedDate)}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {plan.planNo}?</DialogTitle>
            <DialogDescription>A cancelled plan cannot be reopened. Please give a reason.</DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCancel(false)} disabled={isBusy}>
              Keep Plan
            </Button>
            <Button variant="destructive" disabled={isBusy || !reason.trim()} onClick={() => void runAction("cancel", reason.trim())}>
              Cancel Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
