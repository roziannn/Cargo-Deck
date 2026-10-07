"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import { saveShippingPlanLoading, type ShippingPlanDetail } from "@/lib/api/shipping-plan";

const CHECKS = [
  { key: "vehiclePapers", label: "KIR dan STNK kendaraan masih berlaku" },
  { key: "vehicleClean", label: "Bak bersih, kering, dan tidak berbau" },
  { key: "vehicleCondition", label: "Kendaraan layak jalan (ban, lampu, rem, tidak bocor)" },
  { key: "driverReady", label: "Driver sehat dan membawa SIM yang berlaku" },
  { key: "cargoSecured", label: "Muatan sudah ditata, diikat, dan diamankan" },
] as const;

type CheckKey = (typeof CHECKS)[number]["key"];

const decimal = (value: string) => value.replace(/[^\d.,]/g, "");
const toNumber = (value: string) => {
  const n = Number(value.replace(",", "."));
  return value.trim() !== "" && Number.isFinite(n) ? n : null;
};

/** Loading: what was really put on the truck, the pre-departure checklist, seal number and weighbridge reading. */
export function ShippingLoadingDialog({
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
  const [loaded, setLoaded] = useState<Record<string, string>>(() =>
    Object.fromEntries(plan.items.map((item) => [item.cubstoolNewId, String(item.loadedQty ?? item.pickedQty ?? item.qty)])),
  );
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    vehiclePapers: plan.chkVehiclePapers,
    vehicleClean: plan.chkVehicleClean,
    vehicleCondition: plan.chkVehicleCondition,
    driverReady: plan.chkDriverReady,
    cargoSecured: plan.chkCargoSecured,
  });
  const [temp, setTemp] = useState(plan.loadingTempC !== null ? String(plan.loadingTempC) : "");
  const [sealNo, setSealNo] = useState(plan.sealNo ?? "");
  const [tare, setTare] = useState(plan.tareWeightKg ?? "");
  const [gross, setGross] = useState(plan.grossWeightKg ?? "");
  const [notes, setNotes] = useState(plan.loadingNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const limit = (item: ShippingPlanDetail["items"][number]) => item.pickedQty ?? item.qty;
  const qty = (id: string) => {
    const n = Number(loaded[id]);
    return Number.isInteger(n) && n >= 0 ? n : NaN;
  };
  const invalidQty = plan.items.some((item) => Number.isNaN(qty(item.cubstoolNewId)) || qty(item.cubstoolNewId) > limit(item));

  const cargoKg = plan.items.reduce((sum, item) => sum + (Number.isNaN(qty(item.cubstoolNewId)) ? 0 : qty(item.cubstoolNewId)) * Number(item.unitWeightKg ?? 0), 0);
  const tareKg = toNumber(tare);
  const grossKg = toNumber(gross);
  const netKg = tareKg !== null && grossKg !== null ? Math.round((grossKg - tareKg) * 100) / 100 : null;
  const payload = plan.vehicleMaxPayload !== null ? Number(plan.vehicleMaxPayload) : null;
  const isCold = plan.specialHandling === "COLD_CHAIN";

  async function save() {
    if (invalidQty) return void toast.error("Jumlah dimuat harus bilangan bulat dan tidak boleh melebihi yang di-pick.");
    if (tareKg !== null && grossKg !== null && grossKg <= tareKg) return void toast.error("Berat isi harus lebih besar dari berat kosong.");

    setIsSaving(true);
    try {
      const saved = await saveShippingPlanLoading(
        plan.newId,
        {
          items: plan.items.map((item) => ({ cubstoolNewId: item.cubstoolNewId, loadedQty: qty(item.cubstoolNewId) })),
          checklist: checks,
          loadingTempC: toNumber(temp) ?? undefined,
          sealNo: sealNo.trim() || undefined,
          grossWeightKg: grossKg ?? undefined,
          tareWeightKg: tareKg ?? undefined,
          notes: notes.trim() || undefined,
        },
        getStoredAuthToken() ?? undefined,
      );
      toast.success(saved.readiness.complete ? "Loading lengkap. Siap diberangkatkan." : "Data loading tersimpan.");
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan data loading.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Loading — {plan.planNo}</DialogTitle>
          <DialogDescription>
            {plan.plateNo} · {plan.driverName} · {plan.vehicleName}. Semua isian di bawah harus lengkap sebelum truk bisa diberangkatkan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Checklist sebelum berangkat</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {CHECKS.map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-start gap-2 text-sm">
                    <Checkbox checked={checks[key]} onCheckedChange={(value) => setChecks((current) => ({ ...current, [key]: value === true }))} className="mt-0.5" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nomor segel</Label>
                <Input value={sealNo} onChange={(e) => setSealNo(e.target.value.toUpperCase())} placeholder="SEG-000123" />
              </div>
              <div className="space-y-1">
                <Label>Suhu bak (°C){isCold ? " *" : ""}</Label>
                <Input value={temp} onChange={(e) => setTemp(e.target.value.replace(/[^\d.,-]/g, ""))} placeholder={isCold ? "mis. 4.5" : "opsional"} inputMode="decimal" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Timbang (kg, opsional)</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input value={tare} onChange={(e) => setTare(decimal(e.target.value))} placeholder="Berat kosong" inputMode="decimal" />
                <Input value={gross} onChange={(e) => setGross(decimal(e.target.value))} placeholder="Berat isi" inputMode="decimal" />
              </div>
              <div className="rounded-md bg-muted/40 p-2 text-xs">
                {netKg === null ? (
                  <span className="text-muted-foreground">Isi berat kosong dan berat isi untuk melihat berat bersih muatan.</span>
                ) : (
                  <>
                    <span className={payload !== null && netKg > payload ? "font-semibold text-destructive" : "font-semibold"}>Berat bersih {netKg} kg</span>
                    {payload !== null ? ` · max payload ${payload} kg` : ""} · muatan di sistem {Math.round(cargoKg * 10) / 10} kg
                    {payload !== null && netKg > payload ? <div className="mt-1 text-destructive">Melebihi max payload, truk tidak boleh berangkat.</div> : null}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Jumlah yang dimuat</Label>
            <div className="overflow-hidden rounded-lg border">
              <Table containerClassName="rounded-none border-0 bg-transparent">
                <TableHeader>
                  <TableRow>
                    <TableHead>Barang</TableHead>
                    <TableHead className="text-right">Rencana</TableHead>
                    <TableHead className="text-right">Di-pick</TableHead>
                    <TableHead className="w-24 text-right">Dimuat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.items.map((item) => {
                    const value = qty(item.cubstoolNewId);
                    const bad = Number.isNaN(value) || value > limit(item);
                    return (
                      <TableRow key={item.cubstoolNewId}>
                        <TableCell>
                          <div className="text-sm">{item.itemName}</div>
                          <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                        </TableCell>
                        <TableCell className="text-right">{item.qty}</TableCell>
                        <TableCell className="text-right">{item.pickedQty ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            value={loaded[item.cubstoolNewId] ?? ""}
                            onChange={(e) => setLoaded((current) => ({ ...current, [item.cubstoolNewId]: e.target.value.replace(/\D/g, "") }))}
                            inputMode="numeric"
                            aria-invalid={bad}
                            className={`h-8 text-right ${bad ? "border-destructive" : ""}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-1">
              <Label>Catatan loading</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Mis. waktu muat, kondisi karton, kejadian selama muat"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Tutup
          </Button>
          <Button onClick={() => void save()} disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "Simpan Data Loading"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
