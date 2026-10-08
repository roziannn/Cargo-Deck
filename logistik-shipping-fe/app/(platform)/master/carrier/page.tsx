"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SquarePen } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import { createMstCarrier, listMstCarriers, updateMstCarrier, type CarrierType, type MstCarrierItem } from "@/lib/api/mst-logistics";
import { useI18n } from "@/lib/i18n/provider";

type FormState = { code: string; name: string; type: CarrierType; contactName: string; contactPhone: string; isActive: boolean };

const EMPTY_FORM: FormState = { code: "", name: "", type: "3PL", contactName: "", contactPhone: "", isActive: true };

export default function CarrierPage() {
  const { t } = useI18n();
  const [data, setData] = useState<MstCarrierItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const [openForm, setOpenForm] = useState(false);
  const [editingNewId, setEditingNewId] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(await listMstCarriers(getStoredAuthToken() ?? undefined));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : );
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return data.filter((row) => [row.code, row.name, row.type, row.contactName ?? ""].some((v) => v.toLowerCase().includes(keyword)));
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  function openCreate() {
    setEditingNewId("");
    setForm(EMPTY_FORM);
    setOpenForm(true);
  }

  function openEdit(row: MstCarrierItem) {
    setEditingNewId(row.newId);
    setForm({ code: row.code, name: row.name, type: row.type, contactName: row.contactName ?? "", contactPhone: row.contactPhone ?? "", isActive: row.isActive });
    setOpenForm(true);
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error(t("Code dan Name wajib diisi."));
      return;
    }
    setIsSaving(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const payload = { ...form, code: form.code.trim(), name: form.name.trim() };
      if (editingNewId) await updateMstCarrier(editingNewId, payload, token);
      else await createMstCarrier(payload, token);
      toast.success(t('Carrier "{name}" berhasil disimpan.', { name: payload.name }));
      setOpenForm(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Gagal menyimpan carrier."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Master Carrier")}</h1>
        <p className="text-sm text-muted-foreground">{t("Armada sendiri (OWN) dan penyedia angkutan pihak ketiga (3PL) untuk booking pengiriman.")}</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("Search code, name, type, contact...")}
            className="w-full rounded-md px-9 py-2 text-sm"
          />
        </div>
        <Button onClick={openCreate} className="font-medium">
          {t("+ Add Carrier")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>{t("Code")}</TableHead>
              <TableHead>{t("Name")}</TableHead>
              <TableHead>{t("Type")}</TableHead>
              <TableHead>{t("Contact")}</TableHead>
              <TableHead>{t("Is Active")}</TableHead>
              <TableHead className="w-24 text-center">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((row) => (
              <TableRow key={row.newId}>
                <TableCell className="font-medium">{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{row.type === "OWN" ? t("Armada sendiri") : "3PL"}</Badge>
                </TableCell>
                <TableCell>{[row.contactName, row.contactPhone].filter(Boolean).join(" · ") || "-"}</TableCell>
                <TableCell>
                  {row.isActive ? (
                    <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t("Active")}</Badge>
                  ) : (
                    <Badge variant="secondary">{t("Inactive")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center">
                    <SquarePen className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-blue-600" onClick={() => openEdit(row)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(isLoading || paginated.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  {isLoading ? t("Loading data...") : t("No data found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-2 border-t px-3 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            {t("Showing {from} to {to} of {total} entries", {
              from: Math.min(startIndex + 1, filtered.length || 0),
              to: Math.min(startIndex + rowsPerPage, filtered.length),
              total: filtered.length,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-center">
              {t("Page {page} of {total}", { page, total: totalPages })}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingNewId ? t("Edit Carrier") : t("Add Carrier")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("Code")}</Label>
                <Input value={form.code} onChange={(e) => setField("code", e.target.value)} placeholder={t("e.g. CR-034")} />
              </div>
              <div className="space-y-1">
                <Label>{t("Type")}</Label>
                <select
                  value={form.type}
                  onChange={(e) => setField("type", e.target.value as CarrierType)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="OWN">{t("Armada sendiri (OWN)")}</option>
                  <option value="3PL">{t("Pihak ketiga (3PL)")}</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("Name")}</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder={t("Carrier name")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("Contact Name")}</Label>
                <Input value={form.contactName} onChange={(e) => setField("contactName", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{t("Contact Phone")}</Label>
                <Input value={form.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} />
              </div>
            </div>
            {editingNewId && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label>{t("Is Active")}</Label>
                  <p className="text-xs text-muted-foreground">{t("Carrier nonaktif tidak bisa dipilih saat booking.")}</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setField("isActive", checked)} disabled={isSaving} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)} disabled={isSaving}>
              {t("Cancel")}
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? t("Saving...") : editingNewId ? t("Save") : t("Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
