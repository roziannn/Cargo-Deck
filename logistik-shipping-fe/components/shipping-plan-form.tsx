"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStoredAuthToken } from "@/lib/api/auth";
import { listLocationLov, type LocationLovItem } from "@/lib/api/mst-location";
import type { ShippingPlanHeaderPayload, ShippingPriority, SpecialHandling } from "@/lib/api/shipping-plan";


export const EMPTY_PLAN_HEADER: ShippingPlanHeaderPayload = {
  originLocationNewId: "",
  destinationLocationNewId: "",
  requestedDeliveryDate: "",
  plannedShipDate: "",
  priority: "NORMAL",
  specialHandling: null,
  notes: "",
};

export function ShippingPlanForm({
  initial = EMPTY_PLAN_HEADER,
  submitLabel,
  cancelHref,
  onSubmit,
}: {
  initial?: ShippingPlanHeaderPayload;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (values: ShippingPlanHeaderPayload) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [locations, setLocations] = useState<LocationLovItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    listLocationLov(getStoredAuthToken() ?? undefined)
      .then(setLocations)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal mengambil data location."));
  }, []);

  const set = <K extends keyof ShippingPlanHeaderPayload>(key: K, value: ShippingPlanHeaderPayload[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const warehouses = locations.filter((l) => l.type === "WAREHOUSE");
  const customers = locations.filter((l) => l.type === "CUSTOMER");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!values.originLocationNewId || !values.destinationLocationNewId) return toast.error("Origin dan Destination wajib dipilih.");
    if (values.originLocationNewId === values.destinationLocationNewId) return toast.error("Origin dan Destination harus berbeda.");
    if (!values.plannedShipDate || !values.requestedDeliveryDate) return toast.error("Tanggal kirim dan tanggal tiba wajib diisi.");
    if (values.requestedDeliveryDate < values.plannedShipDate) return toast.error("Tanggal tiba tidak boleh sebelum tanggal kirim.");

    setIsSaving(true);
    try {
      await onSubmit(values);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan shipping plan.");
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <Toaster position="top-center" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Origin (Warehouse)</Label>
          <Combobox
            options={warehouses.map((l) => ({ value: l.value, label: l.label }))}
            value={values.originLocationNewId}
            onChange={(v) => set("originLocationNewId", v)}
            placeholder="Select origin"
            searchPlaceholder="Cari gudang..."
          />
        </div>
        <div className="space-y-1">
          <Label>Destination (Customer / DC)</Label>
          <Combobox
            options={customers.map((l) => ({ value: l.value, label: l.label }))}
            value={values.destinationLocationNewId}
            onChange={(v) => set("destinationLocationNewId", v)}
            placeholder="Select destination"
            searchPlaceholder="Cari customer / DC..."
          />
        </div>
        <div className="space-y-1">
          <Label>Planned Ship Date</Label>
          <Input type="date" value={values.plannedShipDate} onChange={(e) => set("plannedShipDate", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Requested Delivery Date</Label>
          <Input type="date" min={values.plannedShipDate || undefined} value={values.requestedDeliveryDate} onChange={(e) => set("requestedDeliveryDate", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Priority</Label>
          <Combobox
            options={[
              { value: "LOW", label: "Low" },
              { value: "NORMAL", label: "Normal" },
              { value: "HIGH", label: "High" },
              { value: "URGENT", label: "Urgent" },
            ]}
            value={values.priority}
            onChange={(v) => set("priority", v as ShippingPriority)}
          />
        </div>
        <div className="space-y-1">
          <Label>Special Handling</Label>
          <Combobox
            options={[
              { value: "", label: "None" },
              { value: "COLD_CHAIN", label: "Cold chain" },
              { value: "FRAGILE", label: "Fragile" },
              { value: "HAZARDOUS", label: "Hazardous" },
            ]}
            value={values.specialHandling ?? ""}
            onChange={(v) => set("specialHandling", (v || null) as SpecialHandling | null)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Notes</Label>
        <textarea
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="Instruksi khusus, jam terima customer, dll."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
