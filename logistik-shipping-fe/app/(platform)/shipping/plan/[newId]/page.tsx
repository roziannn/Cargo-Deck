"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, FileText, Truck } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { ShippingBookingDialog } from "@/components/shipping-booking-dialog";
import { PlanStatusBadge, PriorityBadge } from "@/components/shipping-plan-status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import {
  changeShippingPlanStatus,
  dispatchShippingPlan,
  formatPlanDate,
  formatPlanDateTime,
  formatRupiah,
  getShippingPlan,
  getShippingPlanEstimate,
  type FreightEstimate,
  type ShippingPlanDetail,
  type ShippingPlanStatus,
} from "@/lib/api/shipping-plan";
import { cn } from "@/lib/utils";

const STEPS: { status: ShippingPlanStatus; label: string }[] = [
  { status: "DRAFT", label: "Draft" },
  { status: "PLANNED", label: "Load planned" },
  { status: "APPROVED", label: "Approved" },
  { status: "BOOKED", label: "Booked" },
  { status: "DISPATCHED", label: "Dispatched" },
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
  const router = useRouter();
  const [plan, setPlan] = useState<ShippingPlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [openBooking, setOpenBooking] = useState(false);
  const [openDispatch, setOpenDispatch] = useState(false);
  const [estimate, setEstimate] = useState<FreightEstimate | null>(null);

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

  // before booking, show the cost the plan would have (this is what an approver wants to see)
  const needsEstimate = plan !== null && (plan.status === "PLANNED" || plan.status === "APPROVED") && plan.vehicleNewId !== null;
  useEffect(() => {
    if (!needsEstimate) return;
    let alive = true;
    getShippingPlanEstimate(newId, {}, getStoredAuthToken() ?? undefined)
      .then((result) => alive && setEstimate(result))
      .catch(() => alive && setEstimate(null));
    return () => {
      alive = false;
    };
  }, [needsEstimate, newId, plan?.vehicleNewId, plan?.updatedDate]);

  async function runDispatch() {
    setIsBusy(true);
    try {
      const dispatched = await dispatchShippingPlan(newId, getStoredAuthToken() ?? undefined);
      setPlan(dispatched);
      setOpenDispatch(false);
      toast.success(`Surat jalan ${dispatched.deliveryNoteNo} diterbitkan.`);
      router.push(`/surat-jalan/${newId}`); // same tab: the login token may live in this tab's sessionStorage
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menerbitkan surat jalan.");
      await load();
    } finally {
      setIsBusy(false);
    }
  }

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
          {plan.status === "APPROVED" && (
            <Button onClick={() => setOpenBooking(true)} disabled={isBusy}>
              <Truck className="mr-2 h-4 w-4" /> Booking Armada
            </Button>
          )}
          {plan.status === "BOOKED" && (
            <>
              <Button variant="outline" onClick={() => setOpenBooking(true)} disabled={isBusy}>
                Ubah Booking
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/surat-jalan/${plan.newId}`}>
                  <FileText className="mr-2 h-4 w-4" /> Preview Surat Jalan
                </Link>
              </Button>
              <Button onClick={() => setOpenDispatch(true)} disabled={isBusy}>
                Terbitkan Surat Jalan & Berangkatkan
              </Button>
            </>
          )}
          {plan.status === "DISPATCHED" && (
            <Button asChild>
              <Link href={`/surat-jalan/${plan.newId}`}>
                <FileText className="mr-2 h-4 w-4" /> Cetak Surat Jalan {plan.deliveryNoteNo}
              </Link>
            </Button>
          )}
          {plan.status !== "CANCELLED" && plan.status !== "DISPATCHED" && (
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

      {plan.status === "CANCELLED" ? null : plan.totalCost !== null ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Booking &amp; Biaya</h2>
          <div className="grid gap-6 rounded-lg border p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Carrier">{plan.carrierName || "-"}</Field>
            <Field label="Driver">{plan.driverName || "-"}</Field>
            <Field label="Nomor polisi">{plan.plateNo || "-"}</Field>
            <Field label="Surat jalan">{plan.deliveryNoteNo ? `${plan.deliveryNoteNo} · ${formatPlanDateTime(plan.dispatchedAt)}` : "Belum diterbitkan"}</Field>
            <Field label="Jarak">{plan.distanceKm} km</Field>
            <Field label="Ongkos angkut">
              {formatRupiah(plan.freightCost)}
              <div className="text-xs text-muted-foreground">
                {formatRupiah(plan.baseFee)} + {formatRupiah(plan.perKmFee)}/km
              </div>
            </Field>
            <Field label="Biaya muat + lain">{formatRupiah(Number(plan.loadingFee ?? 0) + Number(plan.otherFee ?? 0))}</Field>
            <Field label="Total biaya">
              <span className="text-base font-semibold">{formatRupiah(plan.totalCost)}</span>
            </Field>
            {plan.bookingNotes ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <Field label="Catatan booking">{plan.bookingNotes}</Field>
              </div>
            ) : null}
          </div>
        </div>
      ) : estimate && plan.items.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Estimasi Biaya</h2>
          {estimate.missing ? (
            <p className="text-sm text-amber-700">{estimate.missing}</p>
          ) : (
            <div className="grid gap-6 rounded-lg border p-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Perkiraan jarak">{estimate.distanceKm} km</Field>
              <Field label="Biaya dasar">{formatRupiah(estimate.baseFee)}</Field>
              <Field label="Tarif per km">{formatRupiah(estimate.perKmFee)}</Field>
              <Field label="Estimasi ongkos angkut">
                <span className="text-base font-semibold">{formatRupiah(estimate.freightCost)}</span>
              </Field>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Belum termasuk biaya muat dan biaya lain. Angka final ditetapkan saat booking armada.</p>
        </div>
      ) : null}

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

      {(plan.status === "APPROVED" || plan.status === "BOOKED") && (
        <ShippingBookingDialog
          key={`${plan.status}-${plan.updatedDate}`}
          plan={plan}
          open={openBooking}
          onOpenChange={setOpenBooking}
          onSaved={(saved) => setPlan(saved)}
        />
      )}

      <Dialog open={openDispatch} onOpenChange={setOpenDispatch}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Terbitkan surat jalan?</DialogTitle>
            <DialogDescription>
              Nomor surat jalan akan diterbitkan dan truk dianggap berangkat. Setelah ini booking tidak bisa diubah dan plan tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
            <div>
              {plan.carrierName} · {plan.driverName} · {plan.plateNo}
            </div>
            <div className="text-muted-foreground">
              {plan.originName} → {plan.destinationName} · {plan.totalUnits} unit · {plan.totalWeightKg} kg
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDispatch(false)} disabled={isBusy}>
              Kembali
            </Button>
            <Button onClick={() => void runDispatch()} disabled={isBusy}>
              Terbitkan & Berangkatkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
