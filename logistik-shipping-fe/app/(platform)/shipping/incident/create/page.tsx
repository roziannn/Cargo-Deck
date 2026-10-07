"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStoredAuthToken } from "@/lib/api/auth";
import { INCIDENT_TYPE_LABEL, createShippingIncident, type IncidentType } from "@/lib/api/shipping-incident";
import { formatPlanDate, listShippingPlans, type ShippingPlan } from "@/lib/api/shipping-plan";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export default function CreateIncidentPage() {
  return (
    <Suspense fallback={null}>
      <CreateIncidentForm />
    </Suspense>
  );
}

function CreateIncidentForm() {
  const router = useRouter();
  const preselected = useSearchParams().get("planId") ?? "";
  const [plans, setPlans] = useState<ShippingPlan[]>([]);
  const [planNewId, setPlanNewId] = useState(preselected);
  const [type, setType] = useState<IncidentType>("DAMAGED");
  const [occurredDate, setOccurredDate] = useState(today());
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    listShippingPlans(getStoredAuthToken() ?? undefined)
      .then((rows) => setPlans(rows.filter((p) => p.status === "DISPATCHED" || p.status === "COMPLETED")))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Gagal mengambil plan."));
  }, []);

  async function save() {
    if (!planNewId) return void toast.error("Pilih plan pengirimannya.");
    if (!description.trim()) return void toast.error("Jelaskan kejadiannya.");
    setIsSaving(true);
    try {
      const saved = await createShippingIncident(
        { planNewId, type, occurredDate, description: description.trim(), targetDate: targetDate || undefined },
        getStoredAuthToken() ?? undefined,
      );
      toast.success(`Insiden ${saved.incidentNo} dilaporkan.`);
      router.push(`/shipping/incident/${saved.newId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal melaporkan insiden.");
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <Link href="/shipping/incident" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" /> Kembali ke daftar insiden
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Lapor Insiden</h1>
        <p className="text-sm text-muted-foreground">Plan tidak selesai otomatis selama masih ada insiden yang belum ditutup.</p>
      </div>

      <div className="max-w-3xl space-y-5 rounded-lg border p-5">
        <div className="space-y-1.5">
          <Label>Plan pengiriman</Label>
          <select value={planNewId} onChange={(e) => setPlanNewId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Pilih plan yang sedang dikirim atau baru selesai</option>
            {plans.map((p) => (
              <option key={p.newId} value={p.newId}>
                {p.planNo} · {p.originName} → {p.destinationName} · {p.status}
              </option>
            ))}
          </select>
          {plans.find((p) => p.newId === planNewId)?.etaDate && (
            <p className="text-xs text-muted-foreground">ETA {formatPlanDate(plans.find((p) => p.newId === planNewId)?.etaDate)}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Jenis insiden</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(INCIDENT_TYPE_LABEL) as [IncidentType, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                aria-pressed={type === value}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm transition-colors",
                  type === value ? "border-blue-600 bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "hover:bg-muted/50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Kejadian</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Apa yang terjadi, barang apa, berapa banyak, di mana"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tanggal kejadian</Label>
            <Input type="date" value={occurredDate} max={today()} onChange={(e) => setOccurredDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Estimasi selesai ditangani (opsional)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-40" />
              {[
                ["+3 hari", 3],
                ["+7 hari", 7],
              ].map(([label, days]) => (
                <Button key={label} type="button" variant="outline" size="sm" onClick={() => setTargetDate(addDays(days as number))}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/shipping/incident">Batal</Link>
          </Button>
          <Button onClick={() => void save()} disabled={isSaving}>
            Laporkan Insiden
          </Button>
        </div>
      </div>
    </div>
  );
}
