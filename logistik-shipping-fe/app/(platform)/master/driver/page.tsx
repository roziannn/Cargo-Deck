"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SquarePen } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import { formatPlanDate } from "@/lib/api/shipping-plan";
import { createMstDriver, listCarrierLov, listMstDrivers, updateMstDriver, type CarrierLovItem, type MstDriverItem } from "@/lib/api/mst-logistics";
import { useI18n } from "@/lib/i18n/provider";

type FormState = { code: string; name: string; phone: string; licenseNo: string; licenseExpiry: string; carrierNewId: string; isActive: boolean };

const EMPTY_FORM: FormState = { code: "", name: "", phone: "", licenseNo: "", licenseExpiry: "", carrierNewId: "", isActive: true };

const today = () => new Date().toISOString().slice(0, 10);

export default function DriverPage() {
  const { t } = useI18n();
  const [data, setData] = useState<MstDriverItem[]>([]);
  const [carriers, setCarriers] = useState<CarrierLovItem[]>([]);
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
      const token = getStoredAuthToken() ?? undefined;
      const [drivers, carrierLov] = await Promise.all([listMstDrivers(token), listCarrierLov(token)]);
      setData(drivers);
      setCarriers(carrierLov);
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
    return data.filter((row) => [row.code, row.name, row.phone ?? "", row.licenseNo ?? "", row.carrierName ?? ""].some((v) => v.toLowerCase().includes(keyword)));
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

  function openEdit(row: MstDriverItem) {
    setEditingNewId(row.newId);
    setForm({
      code: row.code,
      name: row.name,
      phone: row.phone ?? "",
      licenseNo: row.licenseNo ?? "",
      licenseExpiry: row.licenseExpiry ?? "",
      carrierNewId: row.carrierNewId ?? "",
      isActive: row.isActive,
    });
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
      const payload = { ...form, code: form.code.trim(), name: form.name.trim(), carrierNewId: form.carrierNewId || null };
      if (editingNewId) await updateMstDriver(editingNewId, payload, token);
      else await createMstDriver(payload, token);
      toast.success(t('Driver "{name}" berhasil disimpan.', { name: payload.name }));
      setOpenForm(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Gagal menyimpan driver."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Master Driver")}</h1>
        <p className="text-sm text-muted-foreground">{t("Driver beserta SIM-nya. Driver yang terikat ke carrier hanya bisa dipilih untuk carrier itu.")}</p>
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
            placeholder={t("Search code, name, phone, SIM, carrier...")}
            className="w-full rounded-md px-9 py-2 text-sm"
          />
        </div>
        <Button onClick={openCreate} className="font-medium">
          {t("+ Add Driver")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>{t("Code")}</TableHead>
              <TableHead>{t("Name")}</TableHead>
              <TableHead>{t("Phone")}</TableHead>
              <TableHead>{t("SIM")}</TableHead>
              <TableHead>{t("SIM Expiry")}</TableHead>
              <TableHead>{t("Carrier")}</TableHead>
              <TableHead>{t("Is Active")}</TableHead>
              <TableHead className="w-24 text-center">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((row) => {
              const expired = row.licenseExpiry !== null && row.licenseExpiry < today();
              return (
                <TableRow key={row.newId}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.phone || "-"}</TableCell>
                  <TableCell>{row.licenseNo || "-"}</TableCell>
                  <TableCell className={expired ? "font-medium text-destructive" : undefined}>
                    {formatPlanDate(row.licenseExpiry)}
                    {expired ? ` ${t("(kadaluarsa)")}` : ""}
                  </TableCell>
                  <TableCell>{row.carrierName || <span className="text-muted-foreground">{t("Semua carrier")}</span>}</TableCell>
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
              );
            })}
            {(isLoading || paginated.length === 0) && (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
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
            <DialogTitle>{editingNewId ? t("Edit Driver") : t("Add Driver")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("Code")}</Label>
                <Input value={form.code} onChange={(e) => setField("code", e.target.value)} placeholder={t("e.g. DRV-033")} />
              </div>
              <div className="space-y-1">
                <Label>{t("Phone")}</Label>
                <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("Name")}</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder={t("Full name")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("SIM No")}</Label>
                <Input value={form.licenseNo} onChange={(e) => setField("licenseNo", e.target.value)} placeholder="SIM B1 Umum ..." />
              </div>
              <div className="space-y-1">
                <Label>{t("SIM Expiry")}</Label>
                <Input type="date" value={form.licenseExpiry} onChange={(e) => setField("licenseExpiry", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("Carrier")}</Label>
              <Combobox
                options={carriers.map((c) => ({ value: c.value, label: c.label }))}
                value={form.carrierNewId}
                onChange={(v) => setField("carrierNewId", v)}
                placeholder={t("Semua carrier (tidak terikat)")}
                searchPlaceholder={t("Cari carrier...")}
                clearable
              />
            </div>
            {editingNewId && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label>{t("Is Active")}</Label>
                  <p className="text-xs text-muted-foreground">{t("Driver nonaktif tidak bisa dipilih saat booking.")}</p>
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
