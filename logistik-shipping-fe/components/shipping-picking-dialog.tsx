"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/provider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import { saveShippingPlanPicking, type ShippingPlanDetail } from "@/lib/api/shipping-plan";

/** Pick list: record how many cartons were really picked and packed per item. */
export function ShippingPickingDialog({
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
  const { t } = useI18n();
  // default to the planned quantity so the common case is a single click
  const [picked, setPicked] = useState<Record<string, string>>(() =>
    Object.fromEntries(plan.items.map((item) => [item.cubstoolNewId, String(item.pickedQty ?? item.qty)])),
  );
  const [notes, setNotes] = useState(plan.pickingNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const num = (id: string) => {
    const n = Number(picked[id]);
    return Number.isInteger(n) && n >= 0 ? n : NaN;
  };
  const planned = plan.items.reduce((sum, item) => sum + item.qty, 0);
  const total = plan.items.reduce((sum, item) => sum + (Number.isNaN(num(item.cubstoolNewId)) ? 0 : num(item.cubstoolNewId)), 0);
  const invalid = plan.items.some((item) => Number.isNaN(num(item.cubstoolNewId)) || num(item.cubstoolNewId) > item.qty);
  const short = total < planned;

  async function save(complete: boolean) {
    if (invalid) return void toast.error(t("Jumlah pick harus bilangan bulat dan tidak boleh melebihi rencana."));
    if (complete && short && !notes.trim()) return void toast.error(t("Ada selisih dari rencana. Isi catatan penyebabnya."));

    setIsSaving(true);
    try {
      const saved = await saveShippingPlanPicking(
        plan.newId,
        {
          items: plan.items.map((item) => ({ cubstoolNewId: item.cubstoolNewId, pickedQty: num(item.cubstoolNewId) })),
          notes: notes.trim() || undefined,
          complete,
        },
        getStoredAuthToken() ?? undefined,
      );
      toast.success(complete ? t("Picking & packing selesai. Lanjut ke loading.") : t("Hasil picking tersimpan."));
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Gagal menyimpan picking."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Picking & Packing")} — {plan.planNo}</DialogTitle>
          <DialogDescription>{t("Isi jumlah karton yang benar-benar diambil dari gudang dan sudah dikemas. Bawaan sama dengan rencana.")}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border">
          <Table containerClassName="rounded-none border-0 bg-transparent">
            <TableHeader>
              <TableRow>
                <TableHead>{t("Kode")}</TableHead>
                <TableHead>{t("Barang")}</TableHead>
                <TableHead className="text-right">{t("Rencana")}</TableHead>
                <TableHead className="w-28 text-right">{t("Di-pick")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.items.map((item) => {
                const value = num(item.cubstoolNewId);
                const bad = Number.isNaN(value) || value > item.qty;
                return (
                  <TableRow key={item.cubstoolNewId}>
                    <TableCell className="font-medium">{item.itemCode}</TableCell>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        value={picked[item.cubstoolNewId] ?? ""}
                        onChange={(e) => setPicked((current) => ({ ...current, [item.cubstoolNewId]: e.target.value.replace(/\D/g, "") }))}
                        inputMode="numeric"
                        aria-invalid={bad}
                        className={`h-8 text-right ${bad ? "border-destructive" : ""}`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-semibold">
                <TableCell colSpan={2} className="text-right">
                  {t("Total")}
                </TableCell>
                <TableCell className="text-right">{planned}</TableCell>
                <TableCell className={`text-right ${short ? "text-amber-700" : ""}`}>{total}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="space-y-1">
          <Label>{short ? t("Catatan (wajib, ada selisih dari rencana)") : t("Catatan")}</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={t("Mis. stok kurang, karton rusak, diganti batch lain")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("Tutup")}
          </Button>
          <Button variant="outline" onClick={() => void save(false)} disabled={isSaving}>
            {t("Simpan Sementara")}
          </Button>
          <Button onClick={() => void save(true)} disabled={isSaving}>
            {t("Selesai, Lanjut Loading")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
