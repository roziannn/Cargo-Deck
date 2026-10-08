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
import { localeTag } from "@/lib/i18n/locale";
import { useI18n } from "@/lib/i18n/provider";
import { createCoreUser, listCoreUsers, updateCoreUser, type CoreUserItem } from "@/lib/api/core-user";

type FormState = {
  username: string;
  email: string;
  name: string;
  site: string;
  password: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = { username: "", email: "", name: "", site: "", password: "", isActive: true };

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(localeTag(), { day: "2-digit", month: "short", year: "numeric" });
}

export default function UserPage() {
  const { t } = useI18n();
  const [data, setData] = useState<CoreUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(await listCoreUsers(getStoredAuthToken() ?? undefined));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Gagal mengambil data user."));
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return data.filter((row) => [row.username, row.name, row.email, row.site ?? ""].some((v) => v.toLowerCase().includes(keyword)));
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpenForm(true);
  }

  function openEdit(row: CoreUserItem) {
    setEditingId(row.id);
    setForm({ username: row.username, email: row.email, name: row.name, site: row.site ?? "", password: "", isActive: row.isActive });
    setOpenForm(true);
  }

  async function handleSave() {
    if (!form.username.trim() || !form.email.trim() || !form.name.trim()) {
      toast.error(t("Username, Email, dan Name wajib diisi."));
      return;
    }
    if (editingId === null && form.password.length < 8) {
      toast.error(t("Password minimal 8 karakter."));
      return;
    }
    if (editingId !== null && form.password !== "" && form.password.length < 8) {
      toast.error(t("Password baru minimal 8 karakter."));
      return;
    }

    setIsSaving(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        name: form.name.trim(),
        site: form.site.trim() || undefined,
        isActive: form.isActive,
        password: form.password || undefined,
      };
      if (editingId === null) await createCoreUser(payload, token);
      else await updateCoreUser(editingId, payload, token);

      toast.success(t('User "{name}" berhasil disimpan.', { name: payload.username }));
      setOpenForm(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Gagal menyimpan user."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("User")}</h1>
        <p className="text-sm text-muted-foreground">{t("Akun yang bisa login. Hak akses menu diatur lewat Role.")}</p>
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
            placeholder={t("Search username, name, email, site...")}
            className="w-full rounded-md px-9 py-2 text-sm"
          />
        </div>
        <Button onClick={openCreate} className="font-medium">
          {t("+ Add User")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>{t("Name")}</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>{t("Is Active")}</TableHead>
              <TableHead>{t("Created Date")}</TableHead>
              <TableHead className="w-24 text-center">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.username}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.site || "-"}</TableCell>
                <TableCell>
                  {row.isActive ? (
                    <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t("Active")}</Badge>
                  ) : (
                    <Badge variant="secondary">{t("Inactive")}</Badge>
                  )}
                </TableCell>
                <TableCell>{formatDate(row.createdDate)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center">
                    <SquarePen className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-blue-600" onClick={() => openEdit(row)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(isLoading || paginated.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
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
            <DialogTitle>{editingId === null ? t("Add User") : t("Edit User")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Username</Label>
                <Input value={form.username} onChange={(e) => setField("username", e.target.value)} placeholder="e.g. budi.santoso" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label>{t("Site")}</Label>
                <Input value={form.site} onChange={(e) => setField("site", e.target.value)} placeholder="e.g. JKT" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("Name")}</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder={t("Full name")} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="name@company.com" autoComplete="off" />
              {editingId !== null && <p className="text-xs text-muted-foreground">{t("Mengubah email ikut memindahkan keanggotaan role user ini.")}</p>}
            </div>
            <div className="space-y-1">
              <Label>{editingId === null ? t("Password") : t("New Password")}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                placeholder={editingId === null ? t("Minimal 8 karakter") : t("Kosongkan jika tidak diganti")}
                autoComplete="new-password"
              />
            </div>
            {editingId !== null && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label>{t("Is Active")}</Label>
                  <p className="text-xs text-muted-foreground">{t("User nonaktif tidak bisa login.")}</p>
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
              {isSaving ? t("Saving...") : editingId === null ? t("Add") : t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
