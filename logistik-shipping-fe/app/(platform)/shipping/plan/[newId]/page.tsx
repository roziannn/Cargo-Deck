"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, CircleCheck, CircleDashed, FileText, PackageCheck, Truck } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { Arrow, RouteText } from "@/components/route-text";
import { ShippingBookingDialog } from "@/components/shipping-booking-dialog";
import { ShippingLoadingDialog } from "@/components/shipping-loading-dialog";
import { ShippingPickingDialog } from "@/components/shipping-picking-dialog";
import { IncidentStatusBadge } from "@/components/shipping-incident-status";
import { PlanStatusBadge, PriorityBadge } from "@/components/shipping-plan-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import { useI18n } from "@/lib/i18n/provider";
import { INCIDENT_TYPE_LABEL, isIncidentOpen } from "@/lib/api/shipping-incident";
import {
  changeShippingPlanStatus,
  dispatchShippingPlan,
  formatPlanDate,
  formatPlanDateTime,
  formatRupiah,
  getShippingPlan,
  getShippingPlanEstimate,
  receiveShippingPlan,
  startShippingPlanPicking,
  updateShippingPlanEta,
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
  { status: "PICKING", label: "Picking & packing" },
  { status: "LOADING", label: "Loading" },
  { status: "DISPATCHED", label: "Dispatched" },
  { status: "COMPLETED", label: "Completed" },
];

const HANDLING_LABEL: Record<string, string> = { COLD_CHAIN: "Cold chain", FRAGILE: "Fragile", HAZARDOUS: "Hazardous" };

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** History notes written by the server: fixed ones are looked up as they are, the ones with values are matched and rebuilt. */
function translateNote(note: string, t: (text: string, params?: Record<string, string | number>) => string) {
  let m = note.match(/^Load simulation saved \((\d+) item types\)$/);
  if (m) return t("Load simulation saved ({count} item types)", { count: m[1] });
  m = note.match(/^Surat jalan (.+) diterbitkan, ETA (\S+) \(\+(\d+) hari\)$/);
  if (m) return t("Surat jalan {no} diterbitkan, ETA {eta} (+{days} hari)", { no: m[1], eta: m[2], days: m[3] });
  m = note.match(/^ETA diubah ke (\S+) \(\+(\d+) hari\)$/);
  if (m) return t("ETA diubah ke {eta} (+{days} hari)", { eta: m[1], days: m[2] });
  m = note.match(/^Diterima oleh ([^:]+): ([\s\S]+)$/);
  if (m) return t("Diterima oleh {name}: {notes}", { name: m[1], notes: m[2] });
  m = note.match(/^Diterima oleh ([\s\S]+)$/);
  if (m) return t("Diterima oleh {name}", { name: m[1] });
  return t(note);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(label)}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function EtaFields({
  etaDate,
  graceDays,
  onEtaDate,
  onGraceDays,
}: {
  etaDate: string;
  graceDays: string;
  onEtaDate: (value: string) => void;
  onGraceDays: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("Estimasi tiba (ETA)")}</Label>
          <Input type="date" value={etaDate} onChange={(e) => onEtaDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("Masa tunggu (hari)")}</Label>
          <Input value={graceDays} onChange={(e) => onGraceDays(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("Kalau sampai ETA + masa tunggu tidak ada insiden, plan selesai otomatis. Bisa juga ditandai diterima lebih awal.")}
      </p>
    </div>
  );
}

export default function ShippingPlanDetailPage() {
  const { newId } = useParams<{ newId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [plan, setPlan] = useState<ShippingPlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [openBooking, setOpenBooking] = useState(false);
  const [openDispatch, setOpenDispatch] = useState(false);
  const [openPicking, setOpenPicking] = useState(false);
  const [openLoading, setOpenLoading] = useState(false);
  const [openReceive, setOpenReceive] = useState(false);
  const [receivedBy, setReceivedBy] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [openEta, setOpenEta] = useState(false);
  const [etaDate, setEtaDate] = useState("");
  const [graceDays, setGraceDays] = useState("1");
  const [estimate, setEstimate] = useState<FreightEstimate | null>(null);

  const load = useCallback(async () => {
    try {
      setPlan(await getShippingPlan(newId, getStoredAuthToken() ?? undefined));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Gagal mengambil shipping plan."));
    }
  }, [newId, t]);

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

  async function runStartPicking() {
    setIsBusy(true);
    try {
      setPlan(await startShippingPlanPicking(newId, getStoredAuthToken() ?? undefined));
      toast.success(t("Picking & packing dimulai."));
      setOpenPicking(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Gagal memulai picking."));
      await load();
    } finally {
      setIsBusy(false);
    }
  }

  /** ETA and grace days from the form, or null (with a toast) when they are not valid. */
  function readEta() {
    const grace = Number(graceDays);
    if (!etaDate) return void toast.error(t("Isi estimasi tiba."));
    if (!Number.isInteger(grace) || grace < 0 || grace > 30) return void toast.error(t("Masa tunggu harus 0 sampai 30 hari."));
    return { etaDate, graceDays: grace };
  }

  function openEtaForm(forDispatch: boolean) {
    setEtaDate((forDispatch ? plan?.suggestedEtaDate : plan?.etaDate) ?? plan?.suggestedEtaDate ?? "");
    setGraceDays(String(forDispatch ? 1 : (plan?.graceDays ?? 1)));
    if (forDispatch) setOpenDispatch(true);
    else setOpenEta(true);
  }

  async function runEta() {
    const eta = readEta();
    if (!eta) return;
    setIsBusy(true);
    try {
      setPlan(await updateShippingPlanEta(newId, eta, getStoredAuthToken() ?? undefined));
      setOpenEta(false);
      toast.success(t("ETA diperbarui."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Gagal mengubah ETA."));
      await load();
    } finally {
      setIsBusy(false);
    }
  }

  async function runReceive() {
    if (!receivedBy.trim()) return void toast.error(t("Isi nama penerima."));
    setIsBusy(true);
    try {
      setPlan(await receiveShippingPlan(newId, { receivedBy: receivedBy.trim(), notes: receiveNotes.trim() || undefined }, getStoredAuthToken() ?? undefined));
      setOpenReceive(false);
      toast.success(t("Pengiriman ditandai diterima."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Gagal menandai diterima."));
      await load();
    } finally {
      setIsBusy(false);
    }
  }

  async function runDispatch() {
    const eta = readEta();
    if (!eta) return;
    setIsBusy(true);
    try {
      const dispatched = await dispatchShippingPlan(newId, eta, getStoredAuthToken() ?? undefined);
      setPlan(dispatched);
      setOpenDispatch(false);
      toast.success(t("Surat jalan {no} diterbitkan.", { no: dispatched.deliveryNoteNo ?? "" }));
      router.push(`/surat-jalan/${newId}`); // same tab: the login token may live in this tab's sessionStorage
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Gagal menerbitkan surat jalan."));
      await load();
    } finally {
      setIsBusy(false);
    }
  }

  async function runAction(action: "approve" | "cancel", note?: string) {
    setIsBusy(true);
    try {
      setPlan(await changeShippingPlanStatus(newId, action, note, getStoredAuthToken() ?? undefined));
      toast.success(action === "approve" ? t("Plan approved.") : t("Plan cancelled."));
      setOpenCancel(false);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Aksi gagal."));
      await load();
    } finally {
      setIsBusy(false);
    }
  }

  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (!plan) return <div className="p-6 text-sm text-muted-foreground">{t("Loading...")}</div>;

  const editable = plan.status === "DRAFT" || plan.status === "PLANNED";
  const weight = Number(plan.totalWeightKg);
  const payload = plan.vehicleMaxPayload ? Number(plan.vehicleMaxPayload) : null;
  const overweight = payload !== null && weight > payload;
  const stepIndex = STEPS.findIndex((s) => s.status === plan.status);
  const showActuals = plan.status === "PICKING" || plan.status === "LOADING" || plan.status === "DISPATCHED" || plan.status === "COMPLETED";

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Link href="/shipping/plan" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="mr-1 h-4 w-4" /> {t("Back to plans")}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{plan.planNo}</h1>
            <PlanStatusBadge status={plan.status} />
            <PriorityBadge priority={plan.priority} />
          </div>
          <p className="text-sm text-muted-foreground">
            <RouteText from={plan.originName} to={plan.destinationName} />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/shipping/plan/${plan.newId}/edit`}>{t("Edit Details")}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/shipping/container-load/create?planId=${plan.newId}`}>{plan.status === "DRAFT" ? t("Start Load Simulation") : t("Open Load Simulation")}</Link>
              </Button>
            </>
          )}
          {plan.status === "PLANNED" && (
            <Button onClick={() => void runAction("approve")} disabled={isBusy}>
              <Check className="mr-2 h-4 w-4" /> {t("Approve")}
            </Button>
          )}
          {plan.status === "APPROVED" && (
            <Button onClick={() => setOpenBooking(true)} disabled={isBusy}>
              <Truck className="mr-2 h-4 w-4" /> {t("Booking Armada")}
            </Button>
          )}
          {plan.status === "BOOKED" && (
            <>
              <Button variant="outline" onClick={() => setOpenBooking(true)} disabled={isBusy}>
                {t("Ubah Booking")}
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/surat-jalan/${plan.newId}`}>
                  <FileText className="mr-2 h-4 w-4" /> Preview Surat Jalan
                </Link>
              </Button>
              <Button onClick={() => void runStartPicking()} disabled={isBusy}>
                <PackageCheck className="mr-2 h-4 w-4" /> {t("Mulai Picking & Packing")}
              </Button>
            </>
          )}
          {plan.status === "PICKING" && (
            <Button onClick={() => setOpenPicking(true)} disabled={isBusy}>
              <PackageCheck className="mr-2 h-4 w-4" /> {t("Input Hasil Picking")}
            </Button>
          )}
          {plan.status === "LOADING" && (
            <>
              <Button variant={plan.readiness.complete ? "outline" : "default"} onClick={() => setOpenLoading(true)} disabled={isBusy}>
                <Truck className="mr-2 h-4 w-4" /> {t("Input Data Loading")}
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/surat-jalan/${plan.newId}`}>
                  <FileText className="mr-2 h-4 w-4" /> Preview Surat Jalan
                </Link>
              </Button>
              <Button onClick={() => openEtaForm(true)} disabled={isBusy || !plan.readiness.complete} title={plan.readiness.complete ? undefined : t("Lengkapi data loading dulu")}>
                {t("Terbitkan Surat Jalan & Berangkatkan")}
              </Button>
            </>
          )}
          {(plan.status === "DISPATCHED" || plan.status === "COMPLETED") && (
            <Button variant={plan.status === "DISPATCHED" ? "outline" : "default"} asChild>
              <Link href={`/surat-jalan/${plan.newId}`}>
                <FileText className="mr-2 h-4 w-4" /> {t("Cetak Surat Jalan {no}", { no: plan.deliveryNoteNo ?? "" })}
              </Link>
            </Button>
          )}
          {plan.status === "DISPATCHED" && (
            <>
              <Button variant="outline" onClick={() => openEtaForm(false)} disabled={isBusy}>
                {t("Ubah ETA")}
              </Button>
              <Button onClick={() => setOpenReceive(true)} disabled={isBusy}>
                <CircleCheck className="mr-2 h-4 w-4" /> {t("Tandai Diterima")}
              </Button>
            </>
          )}
          {plan.canReportIncident && (
            <Button variant="outline" asChild>
              <Link href={`/shipping/incident/create?planId=${plan.newId}`}>
                <AlertTriangle className="mr-2 h-4 w-4" /> {t("Lapor Insiden")}
              </Link>
            </Button>
          )}
          {plan.status !== "CANCELLED" && plan.status !== "DISPATCHED" && plan.status !== "COMPLETED" && (
            <Button variant="outline" className="text-destructive" onClick={() => setOpenCancel(true)} disabled={isBusy}>
              {t("Cancel Plan")}
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
                {t(step.label)}
              </span>
              {index < STEPS.length - 1 && <Arrow className="mx-0" />}
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-6 rounded-lg border p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Planned ship date">{formatPlanDate(plan.plannedShipDate)}</Field>
        <Field label="Requested delivery">{formatPlanDate(plan.requestedDeliveryDate)}</Field>
        <Field label="Special handling">{plan.specialHandling ? t(HANDLING_LABEL[plan.specialHandling]) : "-"}</Field>
        <Field label="Created by">
          {plan.createdBy || "-"} · {formatPlanDateTime(plan.createdDate)}
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <Field label="Notes">{plan.notes || "-"}</Field>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("Load")}</h2>
        {plan.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("No load simulation saved yet. Use “Start Load Simulation” to choose a vehicle and arrange the cargo.")}</p>
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
                {t("Total weight exceeds the vehicle's max payload. Choose a bigger vehicle or reduce the load before approving.")}
              </div>
            )}
            {payload === null && (
              <p className="text-xs text-muted-foreground">{t("This vehicle has no max payload set, so the weight limit is not checked. Set it in Master Vehicle.")}</p>
            )}

            <div className="overflow-hidden rounded-lg border">
              <Table containerClassName="rounded-none border-0 bg-transparent">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Item Code")}</TableHead>
                    <TableHead>{t("Item")}</TableHead>
                    <TableHead className="text-right">{t("Unit weight (kg)")}</TableHead>
                    <TableHead className="text-right">{t("Qty")}</TableHead>
                    {showActuals && <TableHead className="text-right">{t("Di-pick")}</TableHead>}
                    {showActuals && <TableHead className="text-right">{t("Dimuat")}</TableHead>}
                    <TableHead className="text-right">{t("Weight (kg)")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.items.map((item) => (
                    <TableRow key={item.cubstoolNewId}>
                      <TableCell className="font-medium">{item.itemCode}</TableCell>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell className="text-right">{item.unitWeightKg ?? "-"}</TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
                      {showActuals && (
                        <TableCell className={cn("text-right", item.pickedQty !== null && item.pickedQty < item.qty && "font-medium text-amber-700")}>{item.pickedQty ?? "-"}</TableCell>
                      )}
                      {showActuals && (
                        <TableCell className={cn("text-right", item.loadedQty !== null && item.loadedQty < item.qty && "font-medium text-amber-700")}>{item.loadedQty ?? "-"}</TableCell>
                      )}
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
          <h2 className="text-lg font-semibold">{t("Booking & Biaya")}</h2>
          <div className="grid gap-6 rounded-lg border p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Carrier">{plan.carrierName || "-"}</Field>
            <Field label="Driver">{plan.driverName || "-"}</Field>
            <Field label="Nomor polisi">{plan.plateNo || "-"}</Field>
            <Field label="Surat jalan">{plan.deliveryNoteNo ? `${plan.deliveryNoteNo} · ${formatPlanDateTime(plan.dispatchedAt)}` : t("Belum diterbitkan")}</Field>
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
          <h2 className="text-lg font-semibold">{t("Estimasi Biaya")}</h2>
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
          <p className="text-xs text-muted-foreground">{t("Belum termasuk biaya muat dan biaya lain. Angka final ditetapkan saat booking armada.")}</p>
        </div>
      ) : null}

      {showActuals && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("Picking & Packing")}</h2>
          {(() => {
            const planned = plan.items.reduce((sum, item) => sum + item.qty, 0);
            const picked = plan.items.reduce((sum, item) => sum + (item.pickedQty ?? 0), 0);
            const done = plan.status !== "PICKING";
            return (
              <div className="grid gap-6 rounded-lg border p-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Status">
                  <span className="inline-flex items-center gap-1.5">
                    {done ? <CircleCheck className="h-4 w-4 text-emerald-600" /> : <CircleDashed className="h-4 w-4 text-orange-500" />}
                    {done ? t("Selesai") : t("Sedang berlangsung")}
                  </span>
                </Field>
                <Field label="Karton di-pick">
                  <span className={cn(done && picked < planned && "font-medium text-amber-700")}>
                    {done || picked > 0 ? t("{picked} dari {planned}", { picked, planned }) : t("Belum diisi (rencana {planned})", { planned })}
                  </span>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Catatan picking">{plan.pickingNotes || "-"}</Field>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {(plan.status === "LOADING" || plan.status === "DISPATCHED" || plan.status === "COMPLETED") && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("Loading")}</h2>
          <div className="grid gap-6 rounded-lg border p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("Checklist")}</div>
              {[
                [plan.chkVehiclePapers, "KIR dan STNK"],
                [plan.chkVehicleClean, "Bak bersih"],
                [plan.chkVehicleCondition, "Kendaraan layak jalan"],
                [plan.chkDriverReady, "Driver siap"],
                [plan.chkCargoSecured, "Muatan diamankan"],
              ].map(([ok, label]) => (
                <div key={String(label)} className="flex items-center gap-2 text-sm">
                  {ok ? <CircleCheck className="h-4 w-4 text-emerald-600" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
                  <span className={ok ? undefined : "text-muted-foreground"}>{t(String(label))}</span>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <Field label="Nomor segel">{plan.sealNo || "-"}</Field>
              <Field label="Suhu bak">{plan.loadingTempC !== null ? `${plan.loadingTempC} °C` : "-"}</Field>
            </div>
            <div className="space-y-4">
              <Field label="Timbang (kosong / isi)">
                {plan.tareWeightKg && plan.grossWeightKg ? `${plan.tareWeightKg} / ${plan.grossWeightKg} kg` : "-"}
              </Field>
              <Field label="Berat bersih">
                <span className={cn(plan.readiness.netWeightKg !== null && payload !== null && plan.readiness.netWeightKg > payload && "font-semibold text-destructive")}>
                  {plan.readiness.netWeightKg !== null ? `${plan.readiness.netWeightKg} kg` : "-"}
                </span>
              </Field>
            </div>
            {plan.loadingNotes ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <Field label="Catatan loading">{plan.loadingNotes}</Field>
              </div>
            ) : null}
          </div>

          {plan.status === "LOADING" && plan.readiness.missing.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-medium">{t("Belum bisa diberangkatkan:")}</div>
              <ul className="list-inside list-disc">
                {plan.readiness.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.readiness.warnings.length > 0 && (
            <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
              {plan.readiness.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(plan.status === "DISPATCHED" || plan.status === "COMPLETED") && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("Pengiriman")}</h2>
          <div className="grid gap-6 rounded-lg border p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Estimasi tiba (ETA)">{formatPlanDate(plan.etaDate)}</Field>
            <Field label="Selesai otomatis setelah">
              {plan.etaDate ? formatPlanDate(addDays(plan.etaDate, plan.graceDays)) : "-"}
              <div className="text-xs text-muted-foreground">{t("ETA + {days} hari, kalau tidak ada insiden", { days: plan.graceDays })}</div>
            </Field>
            {plan.status === "COMPLETED" ? (
              <>
                <Field label="Selesai">{formatPlanDateTime(plan.deliveredAt)}</Field>
                <Field label="Diterima oleh">
                  {plan.receivedBy || t("Otomatis (tanpa insiden)")}
                  {plan.receiveNotes && <div className="text-xs text-muted-foreground">{plan.receiveNotes}</div>}
                </Field>
              </>
            ) : (
              <Field label="Status">{t("Dalam perjalanan")}</Field>
            )}
          </div>
        </div>
      )}

      {(plan.incidents.length > 0 || plan.canReportIncident) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("Insiden & Klaim")}</h2>
          {plan.incidents.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("Belum ada insiden.")}</div>
          ) : (
            <div className="space-y-2">
              {plan.incidents.map((incident) => (
                <Link
                  key={incident.newId}
                  href={`/shipping/incident/${incident.newId}`}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm hover:bg-muted/40"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">
                      {incident.incidentNo} · {t(INCIDENT_TYPE_LABEL[incident.type])}
                    </div>
                    <div className="text-muted-foreground">{incident.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("Estimasi selesai {date}", { date: formatPlanDate(incident.targetDate) })}
                      {incident.claimAmount ? ` · ${t("klaim {amount}", { amount: formatRupiah(incident.claimAmount) })}` : ""}
                      {incident.solution && !isIncidentOpen(incident.status) ? ` · ${incident.solution}` : ""}
                    </div>
                  </div>
                  <IncidentStatusBadge status={incident.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("History")}</h2>
        <ol className="space-y-3 border-l pl-4">
          {[...plan.history].reverse().map((h, index) => (
            <li key={index} className="space-y-0.5">
              <div className="text-sm font-medium">
                {h.fromStatus ? (
                  <>
                    {h.fromStatus}
                    <Arrow />
                    {h.toStatus}
                  </>
                ) : (
                  h.toStatus
                )}
              </div>
              {h.note && <div className="text-sm text-muted-foreground">{translateNote(h.note, t)}</div>}
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

      {plan.status === "PICKING" && (
        <ShippingPickingDialog key={`${plan.status}-${plan.updatedDate}`} plan={plan} open={openPicking} onOpenChange={setOpenPicking} onSaved={(saved) => setPlan(saved)} />
      )}
      {plan.status === "LOADING" && (
        <ShippingLoadingDialog key={`${plan.status}-${plan.updatedDate}`} plan={plan} open={openLoading} onOpenChange={setOpenLoading} onSaved={(saved) => setPlan(saved)} />
      )}

      <Dialog open={openDispatch} onOpenChange={setOpenDispatch}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Terbitkan surat jalan?")}</DialogTitle>
            <DialogDescription>
              {t("Nomor surat jalan akan diterbitkan dan truk dianggap berangkat. Setelah ini booking tidak bisa diubah dan plan tidak bisa dibatalkan.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
            <div>
              {plan.carrierName} · {plan.driverName} · {plan.plateNo}
            </div>
            <div className="text-muted-foreground">
              <RouteText from={plan.originName} to={plan.destinationName} /> · {t("{count} karton dimuat", { count: plan.items.reduce((sum, i) => sum + (i.loadedQty ?? 0), 0) })}
            </div>
            <div className="text-muted-foreground">
              {t("Segel {seal} · berat bersih {weight} kg", { seal: plan.sealNo ?? "", weight: plan.readiness.netWeightKg ?? "" })}
            </div>
          </div>
          <EtaFields etaDate={etaDate} graceDays={graceDays} onEtaDate={setEtaDate} onGraceDays={setGraceDays} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDispatch(false)} disabled={isBusy}>
              {t("Kembali")}
            </Button>
            <Button onClick={() => void runDispatch()} disabled={isBusy}>
              {t("Terbitkan & Berangkatkan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openEta} onOpenChange={setOpenEta}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Ubah ETA")}</DialogTitle>
            <DialogDescription>{t("Kalau ETA mundur karena kendala, ubah di sini supaya plan tidak selesai otomatis terlalu cepat.")}</DialogDescription>
          </DialogHeader>
          <EtaFields etaDate={etaDate} graceDays={graceDays} onEtaDate={setEtaDate} onGraceDays={setGraceDays} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEta(false)} disabled={isBusy}>
              {t("Batal")}
            </Button>
            <Button onClick={() => void runEta()} disabled={isBusy}>
              {t("Simpan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openReceive} onOpenChange={setOpenReceive}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Tandai diterima")}</DialogTitle>
            <DialogDescription>{t("Barang sudah sampai di tujuan. Kalau ada yang rusak atau kurang, tandai dulu lalu laporkan sebagai insiden.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("Diterima oleh")}</Label>
              <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder={t("Nama penerima")} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Catatan (opsional)")}</Label>
              <textarea value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenReceive(false)} disabled={isBusy}>
              {t("Batal")}
            </Button>
            <Button onClick={() => void runReceive()} disabled={isBusy}>
              {t("Tandai Diterima")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Cancel {planNo}?", { planNo: plan.planNo })}</DialogTitle>
            <DialogDescription>{t("A cancelled plan cannot be reopened. Please give a reason.")}</DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t("Reason")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCancel(false)} disabled={isBusy}>
              {t("Keep Plan")}
            </Button>
            <Button variant="destructive" disabled={isBusy || !reason.trim()} onClick={() => void runAction("cancel", reason.trim())}>
              {t("Cancel Plan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
