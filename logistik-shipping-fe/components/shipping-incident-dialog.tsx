"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStoredAuthToken } from "@/lib/api/auth";
import { formatPlanDate, formatRupiah } from "@/lib/api/shipping-plan";
import {
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
  createShippingIncident,
  updateShippingIncident,
  type IncidentStatus,
  type IncidentType,
  type ShippingIncident,
} from "@/lib/api/shipping-incident";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const TEXTAREA_CLASS = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const today = () => new Date().toISOString().slice(0, 10);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (incident: ShippingIncident) => void;
} & ({ planNewId: string; planNo: string; incident?: undefined } | { incident: ShippingIncident; planNewId?: undefined; planNo?: undefined });

/** Report a new incident (pass planNewId) or handle an existing one (pass incident): status, estimated date, solution and claim. */
export function ShippingIncidentDialog(props: Props) {
  const { open, onOpenChange, onSaved, incident } = props;
  const [type, setType] = useState<IncidentType>(incident?.type ?? "DAMAGED");
  const [occurredDate, setOccurredDate] = useState(incident?.occurredDate ?? today());
  const [description, setDescription] = useState(incident?.description ?? "");
  const [status, setStatus] = useState<IncidentStatus>(incident?.status ?? "OPEN");
  const [targetDate, setTargetDate] = useState(incident?.targetDate ?? "");
  const [solution, setSolution] = useState(incident?.solution ?? "");
  const [claimAmount, setClaimAmount] = useState(incident?.claimAmount ?? "");
  const [claimParty, setClaimParty] = useState(incident?.claimParty ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const amount = claimAmount.trim() === "" ? undefined : Number(claimAmount);

  async function save() {
    if (!incident && !description.trim()) return void toast.error("Jelaskan kejadiannya.");
    if (incident) {
      if ((status === "RESOLVED" || status === "REJECTED") && !solution.trim()) {
        return void toast.error(status === "RESOLVED" ? "Isi solusi untuk menyelesaikan insiden." : "Isi alasan penolakan di kolom solusi.");
      }
      if (status === "CLAIM_FILED" && (!amount || !claimParty.trim())) return void toast.error("Isi nilai klaim dan pihak yang ditagih.");
    }
    if (amount !== undefined && (!Number.isInteger(amount) || amount < 0)) return void toast.error("Nilai klaim harus rupiah bulat, 0 atau lebih.");

    setIsSaving(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const saved = incident
        ? await updateShippingIncident(
            incident.newId,
            { status, targetDate: targetDate || undefined, solution: solution.trim() || undefined, claimAmount: amount, claimParty: claimParty.trim() || undefined },
            token,
          )
        : await createShippingIncident(
            { planNewId: props.planNewId as string, type, occurredDate, description: description.trim(), targetDate: targetDate || undefined },
            token,
          );
      toast.success(incident ? "Penanganan insiden tersimpan." : `Insiden ${saved.incidentNo} dilaporkan.`);
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan insiden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{incident ? `${incident.incidentNo} · ${INCIDENT_TYPE_LABEL[incident.type]}` : "Lapor Insiden"}</DialogTitle>
          <DialogDescription>
            {incident
              ? `${incident.planNo} · ${incident.originName} → ${incident.destinationName}${incident.carrierName ? ` · ${incident.carrierName}` : ""}`
              : `Untuk plan ${props.planNo}. Plan tidak selesai otomatis selama masih ada insiden yang belum ditutup.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {incident ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="text-xs text-muted-foreground">
                Kejadian {formatPlanDate(incident.occurredDate)} · dilaporkan {incident.createdBy || "-"}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{incident.description}</div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Jenis insiden</Label>
                  <select value={type} onChange={(e) => setType(e.target.value as IncidentType)} className={SELECT_CLASS}>
                    {Object.entries(INCIDENT_TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tanggal kejadian</Label>
                  <Input type="date" value={occurredDate} max={today()} onChange={(e) => setOccurredDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Kejadian</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Apa yang terjadi, barang apa, berapa banyak" className={TEXTAREA_CLASS} />
              </div>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {incident && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus)} className={SELECT_CLASS}>
                  {Object.entries(INCIDENT_STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Estimasi selesai ditangani</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>

          {incident && (
            <>
              <div className="space-y-1.5">
                <Label>Solusi</Label>
                <textarea
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  rows={3}
                  placeholder="Penyelesaiannya: ganti barang, potong tagihan, kirim ulang..."
                  className={TEXTAREA_CLASS}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nilai klaim (Rp, opsional)</Label>
                  <Input value={claimAmount} onChange={(e) => setClaimAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" />
                  {amount ? <div className="text-xs text-muted-foreground">{formatRupiah(amount)}</div> : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Pihak yang ditagih</Label>
                  <Input value={claimParty} onChange={(e) => setClaimParty(e.target.value)} placeholder={incident.carrierName ?? "Carrier / asuransi"} maxLength={100} />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={() => void save()} disabled={isSaving}>
            {incident ? "Simpan Penanganan" : "Laporkan Insiden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
