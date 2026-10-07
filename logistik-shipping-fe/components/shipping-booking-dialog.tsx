"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStoredAuthToken } from "@/lib/api/auth";
import { listCarrierLov, listDriverLov, type CarrierLovItem, type DriverLovItem } from "@/lib/api/mst-logistics";
import {
  formatPlanDate,
  formatRupiah,
  getShippingPlanEstimate,
  saveShippingPlanBooking,
  type FreightEstimate,
  type ShippingPlanDetail,
} from "@/lib/api/shipping-plan";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

const toInt = (value: string) => {
  const n = Number(value.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "border-t pt-2 text-base font-semibold" : "text-sm"}`}>
      <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ShippingBookingDialog({
  plan,
  open,
  onOpenChange,
  onSaved,
}: {
  plan: ShippingPlanDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (plan: ShippingPlanDetail) => void;
}) {
  const [carriers, setCarriers] = useState<CarrierLovItem[]>([]);
  const [drivers, setDrivers] = useState<DriverLovItem[]>([]);
  const [carrierNewId, setCarrierNewId] = useState(plan.carrierNewId ?? "");
  const [driverNewId, setDriverNewId] = useState(plan.driverNewId ?? "");
  const [plateNo, setPlateNo] = useState(plan.plateNo ?? "");
  const [distance, setDistance] = useState("");
  const [loadingFee, setLoadingFee] = useState(plan.loadingFee && plan.loadingFee !== "0" ? plan.loadingFee : "");
  const [otherFee, setOtherFee] = useState(plan.otherFee && plan.otherFee !== "0" ? plan.otherFee : "");
  const [notes, setNotes] = useState(plan.bookingNotes ?? "");
  const [estimate, setEstimate] = useState<FreightEstimate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const token = getStoredAuthToken() ?? undefined;
    Promise.all([listCarrierLov(token), listDriverLov(token)])
      .then(([c, d]) => {
        setCarriers(c);
        setDrivers(d);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal mengambil data carrier / driver."));
  }, [open]);

  // live estimate from the server, so the preview always matches what booking will store
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      getShippingPlanEstimate(plan.newId, { distanceKm: Number(distance.replace(",", ".")) || undefined, loadingFee: toInt(loadingFee), otherFee: toInt(otherFee) }, getStoredAuthToken() ?? undefined)
        .then((result) => alive && setEstimate(result))
        .catch((error) => alive && toast.error(error instanceof Error ? error.message : "Gagal menghitung estimasi."));
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, plan.newId, distance, loadingFee, otherFee]);

  const availableDrivers = useMemo(
    () => drivers.filter((d) => !d.carrierNewId || (carrierNewId !== "" && d.carrierNewId.toLowerCase() === carrierNewId.toLowerCase())),
    [drivers, carrierNewId],
  );
  const licenseExpired = (d: DriverLovItem) => d.licenseExpiry !== null && d.licenseExpiry < plan.plannedShipDate;

  async function handleSave() {
    if (!carrierNewId) return void toast.error("Pilih carrier.");
    if (!driverNewId) return void toast.error("Pilih driver.");
    if (!plateNo.trim()) return void toast.error("Nomor polisi wajib diisi.");
    if (estimate?.missing) return void toast.error(estimate.missing);

    setIsSaving(true);
    try {
      const saved = await saveShippingPlanBooking(
        plan.newId,
        {
          carrierNewId,
          driverNewId,
          plateNo: plateNo.trim(),
          distanceKm: Number(distance.replace(",", ".")) || undefined,
          loadingFee: toInt(loadingFee),
          otherFee: toInt(otherFee),
          bookingNotes: notes.trim() || undefined,
        },
        getStoredAuthToken() ?? undefined,
      );
      toast.success("Booking tersimpan.");
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan booking.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan.status === "BOOKED" ? "Ubah Booking" : "Booking Armada"} — {plan.planNo}</DialogTitle>
          <DialogDescription>
            {plan.originName} → {plan.destinationName} · kirim {formatPlanDate(plan.plannedShipDate)} · {plan.vehicleName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Carrier</Label>
              <select
                className={SELECT_CLASS}
                value={carrierNewId}
                onChange={(e) => {
                  setCarrierNewId(e.target.value);
                  setDriverNewId("");
                }}
              >
                <option value="">Pilih carrier</option>
                {carriers.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} ({c.type === "OWN" ? "armada sendiri" : "3PL"})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Driver</Label>
              <select className={SELECT_CLASS} value={driverNewId} onChange={(e) => setDriverNewId(e.target.value)} disabled={!carrierNewId}>
                <option value="">{carrierNewId ? "Pilih driver" : "Pilih carrier dulu"}</option>
                {availableDrivers.map((d) => (
                  <option key={d.value} value={d.value} disabled={licenseExpired(d)}>
                    {d.label}
                    {licenseExpired(d) ? " — SIM kadaluarsa" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Nomor Polisi</Label>
              <Input value={plateNo} onChange={(e) => setPlateNo(e.target.value.toUpperCase())} placeholder="B 1234 XYZ" />
            </div>
            <div className="space-y-1">
              <Label>Catatan</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Mis. jadwal muat, instruksi untuk driver"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="text-sm font-semibold">Estimasi biaya</div>
              {estimate === null ? (
                <div className="text-sm text-muted-foreground">Menghitung...</div>
              ) : estimate.missing ? (
                <div className="text-sm text-amber-700">{estimate.missing}</div>
              ) : (
                <div className="space-y-1.5">
                  <Row
                    label={`Jarak (${estimate.distanceSource === "manual" ? "manual" : "perkiraan jalan"})`}
                    value={`${estimate.distanceKm} km`}
                  />
                  <Row label="Biaya dasar" value={formatRupiah(estimate.baseFee)} />
                  <Row label={`${formatRupiah(estimate.perKmFee)} / km × ${estimate.distanceKm} km`} value={formatRupiah((estimate.freightCost ?? 0) - (estimate.baseFee ?? 0))} />
                  <Row label="Ongkos angkut" value={formatRupiah(estimate.freightCost)} />
                  <Row label="Biaya muat" value={formatRupiah(estimate.loadingFee)} />
                  <Row label="Biaya lain" value={formatRupiah(estimate.otherFee)} />
                  <Row label="Total" value={formatRupiah(estimate.totalCost)} strong />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Jarak manual (km)</Label>
              <Input value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Kosongkan untuk pakai perkiraan" inputMode="decimal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Biaya muat (Rp)</Label>
                <Input value={loadingFee} onChange={(e) => setLoadingFee(e.target.value.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label>Biaya lain (Rp)</Label>
                <Input value={otherFee} onChange={(e) => setOtherFee(e.target.value.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ongkos angkut = biaya dasar + tarif per km × jarak, dibulatkan ke atas per Rp 1.000. Tarif diambil dari Master Vehicle.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving || estimate === null || Boolean(estimate.missing)}>
            {isSaving ? "Menyimpan..." : plan.status === "BOOKED" ? "Simpan Perubahan" : "Simpan Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
