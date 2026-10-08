"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Search, ChevronLeft, ChevronRight, CircleCheck, XCircle, Edit, KeyRound, Users, Plus, Import } from "lucide-react";

import { DateFormat } from "@/utils/date-format";
import * as XLSX from "xlsx";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/provider";

type Account = {
  id: number;
  nik: string;
  name: string;
  role: string;
  department: string;
  jobLevel: string;
  updatedAt: string;
  isActive: boolean;
  email?: string;
};

type RoleGroup = {
  id: number;
  name: string;
  description?: string;
};

export default function AccountPage() {
  const { t } = useI18n();
  const data: Account[] = [
    {
      id: 1,
      nik: "202500",
      name: "Kevin Andrew Herianto",
      role: "administrator",
      department: "MSTD",
      jobLevel: "IT Functional Developer Supervisor",
      updatedAt: "2025-12-12 09:42",
      isActive: true,
      email: "kevin@company.com",
    },
    {
      id: 2,
      nik: "202501",
      name: "Maya",
      role: "QA Manager",
      department: "QA",
      jobLevel: "QA Line Manager NBL Oral",
      updatedAt: "2025-12-13 10:10",
      isActive: false,
      email: "maya@company.com",
    },
    {
      id: 3,
      nik: "202508",
      name: "Savira Rahmawati",
      role: "TS Supervisor",
      department: "QA",
      jobLevel: "TS Line Supervisor",
      updatedAt: "2025-12-13 10:10",
      isActive: false,
      email: "savira.yunaz@company.com",
    },
  ];

  const [roles, setRoles] = useState<RoleGroup[]>([
    { id: 1, name: "Administrator", description: "Full access" },
    { id: 2, name: "TS Supervisor", description: "TS Supervisor" },
    { id: 4, name: "TS Staff", description: "TS Staff" },
    { id: 5, name: "QA Manager", description: "QA Manager" },
  ]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const [openResetPassword, setOpenResetPassword] = useState(false);

  const [openEdit, setOpenEdit] = useState(false);

  const [openImport, setOpenImport] = useState(false);
  const [openAddAccount, setOpenAddAccount] = useState(false);

  const [openRoleGroup, setOpenRoleGroup] = useState(false);
  const [openAddRole, setOpenAddRole] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [preview, setPreview] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  const [selected, setSelected] = useState<Account | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const [createForm, setCreateForm] = useState({
    nik: "",
    name: "",
    role: "",
    department: "",
    jobLevel: "",
    email: "",
  });

  const filtered = data.filter(
    (row) =>
      row.nik.toLowerCase().includes(search.toLowerCase()) || row.name.toLowerCase().includes(search.toLowerCase()) || row.role.toLowerCase().includes(search.toLowerCase()) || row.department.toLowerCase().includes(search.toLowerCase()),
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = XLSX.utils.sheet_to_json<any>(worksheet, {
      defval: "",
    });

    if (json.length === 0) {
      setPreview([]);
      setHeaders([]);
      return;
    }

    const firstSixHeaders = Object.keys(json[0]).slice(0, 6);

    const trimmed = json.map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = {};
      firstSixHeaders.forEach((h) => {
        obj[h] = row[h];
      });
      return obj;
    });

    setHeaders(firstSixHeaders);
    setPreview(trimmed.slice(0, 10));
  };

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);
  const totalEntries = filtered.length;
  const fromEntry = totalEntries === 0 ? 0 : Math.min(startIndex + 1, totalEntries);
  const toEntry = totalEntries === 0 ? 0 : Math.min(startIndex + rowsPerPage, totalEntries);

  return (
    <div className="p-6 space-y-6 dark:bg-zinc-900 min-h-screen">
       <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("Account")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("Manage account for manufacturing process control and monitoring.")}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("Search account...")}
            className="w-full rounded-md border border-input bg-background px-9 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="font-medium" onClick={() => setOpenImport(true)}>
            <Import /> {t("Import")}
          </Button>

          <Button className="font-medium" onClick={() => setOpenAddAccount(true)}>
            {t("+ Add Account")}
          </Button>

          <Button variant="outline" className="gap-2" onClick={() => setOpenRoleGroup(true)}>
            <Users className="h-4 w-4" />
            {t("Role Group")}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>NIK</TableHead>
              <TableHead>{t("Name")}</TableHead>
              <TableHead>{t("Role")}</TableHead>
              <TableHead>{t("Department")}</TableHead>
              <TableHead>{t("Job Level")}</TableHead>
              <TableHead>{t("Updated At")}</TableHead>
              <TableHead>{t("Is Active")}</TableHead>
              <TableHead className="w-16 text-center">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginated.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/40 transition">
                <TableCell>{row.nik}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell className="capitalize">{row.role}</TableCell>
                <TableCell>{row.department}</TableCell>
                <TableCell>{row.jobLevel}</TableCell>
                <TableCell>{DateFormat(row.updatedAt)}</TableCell>
                <TableCell>
                  {row.isActive ? (
                    <Badge variant="default">
                      <CircleCheck className="w-3 h-3" />
                      {t("Active")}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="w-3 h-3" />
                      {t("Inactive")}
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Edit
                      className="w-4 h-4 cursor-pointer text-muted-foreground hover:text-blue-600 transition"
                      onClick={() => {
                        setSelected(row);
                        setIsActive(row.isActive);
                        setOpenEdit(true);
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  {t("No data found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-2 border-t px-3 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            {t("Showing {from} to {to} of {total} entries", { from: fromEntry, to: toEntry, total: totalEntries })}
          </span>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="min-w-24 text-center text-foreground">
              {t("Page {page} of {total}", { page, total: totalPages || 1 })}
            </span>

            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages || totalPages === 0} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* import */}
      <Dialog open={openImport} onOpenChange={setOpenImport}>
        <DialogContent className="w-[98vw] max-w-none overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t("Import from Excel")}</DialogTitle>
          </DialogHeader>

          {/* wrapper utama supaya body bisa stretch */}
          <div className="flex flex-col gap-4 h-full overflow-hidden">
            <div>
              <Input type="file" accept=".xlsx,.xls" onChange={handleFile} />
            </div>

            {preview.length > 0 && (
              <div className="flex-1 border rounded-md overflow-auto">
                <Table className="min-w-max">
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell key={h} className="whitespace-nowrap">
                            {String(row[h] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={() => setOpenImport(false)}>
                {t("Cancel")}
              </Button>

              <Button
                disabled={preview.length === 0}
                onClick={() => {
                  console.log("ready to import", preview);
                  setOpenImport(false);
                }}
              >
                {t("Import Data")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* edit modal */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Edit Account")}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 mb-4">
              <div className="space-y-1">
                <Label>NIK</Label>
                <Input value={selected.nik} disabled />
              </div>

              <div className="space-y-1">
                <Label>{t("Name")}</Label>
                <Input defaultValue={selected.name} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>{t("Role")}</Label>
                  <select defaultValue={selected.role} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>{t("Department")}</Label>
                  <select defaultValue={selected.department} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="MSTD">MSTD</option>
                    <option value="TS">TS</option>
                    <option value="QA">QA</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t("Job Level")}</Label>
                <Input defaultValue={selected.jobLevel} />
              </div>

              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" defaultValue={selected.email ?? `${selected.nik}@company.com`} />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>{t("Status")}</Label>
                  <p className="text-xs text-muted-foreground">{t("Set account as active or inactive")}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{isActive ? t("Active") : t("Inactive")}</span>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between gap-2">
            <Button
              variant="destructive"
              type="button"
              onClick={() => {
                setOpenResetPassword(true);
              }}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {t("Reset Password")}
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpenEdit(false)}>
                {t("Cancel")}
              </Button>
              <Button>{t("Save Changes")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* add modal */}
      <Dialog open={openAddAccount} onOpenChange={setOpenAddAccount}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add Account")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mb-4">
            <div className="space-y-1">
              <Label>NIK</Label>
              <Input value={createForm.nik} onChange={(e) => setCreateForm((p) => ({ ...p, nik: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>{t("Name")}</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("Role")}</Label>
                <select value={createForm.role} onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">{t("Select role")}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>{t("Department")}</Label>
                <select value={createForm.department} onChange={(e) => setCreateForm((p) => ({ ...p, department: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">{t("Select department")}</option>
                  <option value="MSTD">MSTD</option>
                  <option value="TS">TS</option>
                  <option value="QA">QA</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t("Job Level")}</Label>
              <Input value={createForm.jobLevel} onChange={(e) => setCreateForm((p) => ({ ...p, jobLevel: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenAddAccount(false)}>
              {t("Cancel")}
            </Button>

            <Button
              onClick={() => {
                console.log("CREATE ACCOUNT", createForm);

                setCreateForm({
                  nik: "",
                  name: "",
                  role: "",
                  department: "",
                  jobLevel: "",
                  email: "",
                });

                setOpenAddAccount(false);
              }}
            >
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* role group modal */}
      <Dialog open={openRoleGroup} onOpenChange={setOpenRoleGroup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Role Group")}</DialogTitle>
          </DialogHeader>

          <div className="flex justify-start">
            <Button size="sm" className="gap-1" onClick={() => setOpenAddRole(true)}>
              <Plus className="h-4 w-4" />
              {t("Add Role")}
            </Button>
          </div>

          <div className="space-y-2">
            {roles.map((role) => (
              <div key={role.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium capitalize">{role.name}</p>
                  {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    console.log("edit role", role.id);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRoleGroup(false)}>
              {t("Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* reset password confirm modal */}
      <Dialog open={openResetPassword} onOpenChange={setOpenResetPassword}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Reset password")}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">{t("Reset password for this account?")}</p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenResetPassword(false)}>
              {t("Cancel")}
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                console.log("RESET PASSWORD CONFIRMED", selected?.id);

                setOpenResetPassword(false);
              }}
            >
              {t("Yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* add role modal */}
      <Dialog open={openAddRole} onOpenChange={setOpenAddRole}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Add Role Group")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("Role Name")}</Label>
              <Input placeholder={t("ex: QC Supervisor")} value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>{t("Description")}</Label>
              <Input placeholder={t("optional")} value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpenAddRole(false)}>
              {t("Cancel")}
            </Button>

            <Button
              disabled={!newRoleName}
              onClick={() => {
                setRoles((prev) => [
                  ...prev,
                  {
                    id: Date.now(),
                    name: newRoleName,
                    description: newRoleDesc,
                  },
                ]);

                setNewRoleName("");
                setNewRoleDesc("");
                setOpenAddRole(false);
              }}
            >
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
