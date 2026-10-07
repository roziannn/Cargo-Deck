"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Ban, CalendarClock, ChevronLeft, CircleCheck, FileWarning, Hourglass, Inbox, Receipt, Save } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { IncidentStatusBadge } from "@/components/shipping-incident-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStoredAuthToken } from "@/lib/api/auth";
import {
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
  getShippingIncident,
  isIncidentOpen,
  updateShippingIncident,
  type IncidentStatus,
  type ShippingIncidentDetail,
} from "@/lib/api/shipping-incident";
import { formatPlanDate, formatPlanDateTime, formatRupiah } from "@/lib/api/shipping-plan";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { status: IncidentStatus; hint: string; icon: typeof Inbox }[] = [
  { status: "OPEN", hint: "Baru dilaporkan, belum ada tindakan.", icon: Inbox },
  { status: "IN_PROGRESS", hint: "Sedang ditangani: menghubungi carrier, gudang, atau penerima.", icon: Hourglass },
  { status: "CLAIM_FILED", hint: "Kerugian ditagihkan ke carrier atau asuransi. Isi nilai dan pihak yang ditagih.", icon: Receipt },
  { status: "RESOLVED", hint: "Masalah sudah beres. Tuliskan solusinya.", icon: CircleCheck },
  { status: "REJECTED", hint: "Laporan tidak valid atau klaim ditolak. Tuliskan alasannya di solusi.", icon: Ban },
];

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const TEXTAREA_CLASS = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default function ShippingIncidentDetailPage() {
  const { newId } = useParams<{ newId: string }>();
  const [incident, setIncident] = useState<ShippingIncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [status, setStatus] = useState<IncidentStatus>("OPEN");
  const [targetDate, setTargetDate] = useState("");
  const [solution, setSolution] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [claimParty, setClaimParty] = useState("");
  const [note, setNote] = useState("");

  const fill = useCallback((data: ShippingIncidentDetail) => {
    setIncident(data);
    setStatus(data.status);
    setTargetDate(data.targetDate ?? "");
    setSolution(data.solution ?? "");
    setClaimAmount(data.claimAmount ?? "");
    setClaimParty(data.claimParty ?? "");
    setNote("");
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      getShippingIncident(newId, getStoredAuthToken() ?? undefined)
        .then(fill)
        .catch((e) => setError(e instanceof Error ? e.message : "Gagal mengambil insiden."));
    }, 0);
    return () => window.clearTimeout(id);
  }, [newId, fill]);

  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (!incident) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  const amount = claimAmount.trim() === "" ? null : Number(claimAmount);
  const closing = status === "RESOLVED" || status === "REJECTED";
  const showClaim = status === "CLAIM_FILED" || incident.claimAmount !== null || amount !== null || claimParty.trim() !== "";
  const overdue = isIncidentOpen(incident.status) && incident.targetDate !== null && incident.targetDate < today();
  const dirty =
    status !== incident.status ||
    targetDate !== (incident.targetDate ?? "") ||
    solution.trim() !== (incident.solution ?? "") ||
    (amount ?? null) !== (incident.claimAmount === null ? null : Number(incident.claimAmount)) ||
    claimParty.trim() !== (incident.claimParty ?? "") ||
    note.trim() !== "";
  const hint = STATUS_OPTIONS.find((o) => o.status === status)?.hint;

  async function save() {
    if (closing && !solution.trim()) return void toast.error(status === "RESOLVED" ? "Isi solusi untuk menyelesaikan insiden." : "Isi alasan penolakan di kolom solusi.");
    if (status === "CLAIM_FILED" && (!amount || !claimParty.trim())) return void toast.error("Isi nilai klaim dan pihak yang ditagih.");
    if (amount !== null && (!Number.isInteger(amount) || amount < 0)) return void toast.error("Nilai klaim harus rupiah bulat, 0 atau lebih.");

    setIsSaving(true);
    try {
      const saved = await updateShippingIncident(
        newId,
        {
          status,
          targetDate: targetDate || undefined,
          solution: solution.trim() || undefined,
          claimAmount: amount ?? undefined,
          claimParty: claimParty.trim() || undefined,
          note: note.trim() || undefined,
        },
        getStoredAuthToken() ?? undefined,
      );
      fill(saved);
      toast.success("Penanganan tersimpan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan penanganan.");
    } finally {
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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{incident.incidentNo}</h1>
          <span className="rounded-md border px-2 py-0.5 text-sm">{INCIDENT_TYPE_LABEL[incident.type]}</span>
          <IncidentStatusBadge status={incident.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-4 rounded-lg border p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <FileWarning className="h-5 w-5 text-amber-600" /> Kejadian
            </h2>
            <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm leading-relaxed">{incident.description}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Tanggal kejadian">{formatPlanDate(incident.occurredDate)}</Field>
              <Field label="Dilaporkan oleh">
                {incident.createdBy || "-"}
                <div className="text-xs text-muted-foreground">{formatPlanDateTime(incident.createdDate)}</div>
              </Field>
              <Field label="Plan">
                <Link href={`/shipping/plan/${incident.planNewId}`} className="text-blue-600 hover:underline">
                  {incident.planNo}
                </Link>
              </Field>
              <Field label="Rute">
                {incident.originName} → {incident.destinationName}
              </Field>
              <Field label="Carrier">{incident.carrierName || "-"}</Field>
              <Field label="Estimasi selesai">
                <span className={cn(overdue && "font-medium text-red-600")}>
                  {formatPlanDate(incident.targetDate)}
                  {overdue && " (terlewat)"}
                </span>
              </Field>
            </div>
          </section>

          <section className="space-y-5 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Penanganan</h2>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {STATUS_OPTIONS.map(({ status: value, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    aria-pressed={status === value}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors",
                      status === value ? "border-blue-600 bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "hover:bg-muted/50",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {INCIDENT_STATUS_LABEL[value]}
                  </button>
                ))}
              </div>
              {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Estimasi selesai ditangani
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-44" />
                {[
                  ["Besok", 1],
                  ["+3 hari", 3],
                  ["+7 hari", 7],
                ].map(([label, days]) => (
                  <Button key={label} type="button" variant="outline" size="sm" onClick={() => setTargetDate(addDays(days as number))}>
                    {label}
                  </Button>
                ))}
                {targetDate && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTargetDate("")}>
                    Hapus
                  </Button>
                )}
              </div>
            </div>

            {showClaim && (
              <div className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nilai klaim (Rp){status === "CLAIM_FILED" && <span className="text-red-600"> *</span>}</Label>
                  <Input value={claimAmount} onChange={(e) => setClaimAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" />
                  {amount ? <div className="text-xs text-muted-foreground">{formatRupiah(amount)}</div> : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Pihak yang ditagih{status === "CLAIM_FILED" && <span className="text-red-600"> *</span>}</Label>
                  <Input value={claimParty} onChange={(e) => setClaimParty(e.target.value)} placeholder={incident.carrierName ?? "Carrier / asuransi"} maxLength={100} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                Solusi{closing && <span className="text-red-600"> *</span>}
              </Label>
              <textarea
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                rows={3}
                placeholder="Penyelesaiannya: ganti barang, potong tagihan, kirim ulang..."
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Catatan perkembangan (opsional)</Label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Mis. sudah telepon carrier, menunggu foto kerusakan"
                className={TEXTAREA_CLASS}
              />
              <p className="text-xs text-muted-foreground">Masuk ke riwayat kejadian di samping.</p>
            </div>

            <div className="flex items-center justify-end gap-3">
              {!dirty && <span className="text-sm text-muted-foreground">Belum ada perubahan</span>}
              <Button onClick={() => void save()} disabled={isSaving || !dirty}>
                <Save className="mr-2 h-4 w-4" /> Simpan Penanganan
              </Button>
            </div>
          </section>
        </div>

        <section className="h-fit space-y-4 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">Riwayat Kejadian</h2>
          <ol className="space-y-4 border-l pl-4">
            {incident.history.map((h, index) => (
              <li key={index} className="relative space-y-0.5">
                <span className={cn("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background", index === 0 ? "bg-blue-600" : "bg-muted-foreground/40")} />
                <div className="text-sm font-medium">
                  {h.fromStatus && h.fromStatus !== h.toStatus
                    ? `${INCIDENT_STATUS_LABEL[h.fromStatus as IncidentStatus] ?? h.fromStatus} → ${INCIDENT_STATUS_LABEL[h.toStatus]}`
                    : INCIDENT_STATUS_LABEL[h.toStatus]}
                </div>
                {h.note && <div className="text-sm text-muted-foreground">{h.note}</div>}
                <div className="text-xs text-muted-foreground">
                  {h.changedBy || "-"} · {formatPlanDateTime(h.changedDate)}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
