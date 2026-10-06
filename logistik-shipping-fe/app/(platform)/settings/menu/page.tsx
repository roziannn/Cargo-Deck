"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { getStoredAuthToken, getStoredAuthUser } from "@/lib/api/auth";
import { createCoreMenu, createCoreMenuComponent, listCoreMenusMaster, updateCoreMenu, type CoreMenuFunctionItem, type CoreMenuItem } from "@/lib/api/core-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster, toast } from "react-hot-toast";
import { Search, ChevronLeft, ChevronRight, CircleCheck, Circle, Clock, Edit, Plus, Settings, XCircle } from "lucide-react";
import { DateFormat } from "@/utils/date-format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type MenuSetting = {
  id: number;
  newId: string;
  name: string;
  parentId: string | null;
  seq: number | null;
  icon: string;
  path: string;
  isVisible: boolean;
  isActive: boolean;
  isDevelopment: boolean;
  createdBy: string;
  createdDate: string;
  functionBtn: MenuFunction[];
  subMenu: MenuSetting[];
};

type MenuFunction = {
  name: string;
  path: string;
  isActive: boolean;
};

function normalizeMenuId(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function StatusBadge({ label, tone }: { label: string; tone: "success" | "info" | "muted" | "danger" | "progress" }) {
  if (tone === "muted") {
    return <Badge variant="secondary">{label}</Badge>;
  }

  if (tone === "danger") {
    return (
      <Badge variant="destructive" className="gap-1.5">
        <XCircle className="h-3 w-3" />
        {label}
      </Badge>
    );
  }

  if (tone === "progress") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Clock className="h-3 w-3" />
        {label}
      </Badge>
    );
  }

  const toneClassName =
    tone === "success"
      ? "border border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300"
      : "border border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";

  return (
    <Badge className={`gap-1.5 ${toneClassName}`}>
      <CircleCheck className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function mapMenuSetting(item: CoreMenuItem): MenuSetting {
  return {
    id: item.id,
    newId: item.newId,
    name: item.name,
    parentId: item.parentId,
    seq: item.seq,
    icon: item.icon,
    path: item.path,
    isVisible: item.isVisible,
    isActive: item.isActive,
    isDevelopment: item.isDevelopment,
    createdBy: item.createdBy,
    createdDate: item.createdDate,
    functionBtn: item.functionBtn.map(mapMenuFunction),
    subMenu: item.subMenu.map(mapMenuSetting),
  };
}

function formatMenuDate(value: string) {
  if (!value || value === "-") return "-";
  const formatted = DateFormat(value);
  return formatted.replace(/:\d{2}(?!.*\d)/, "");
}

function updateMenuNode(nodes: MenuSetting[], targetNewId: string, updater: (node: MenuSetting) => MenuSetting): MenuSetting[] {
  return nodes.map((node) => {
    if (node.newId === targetNewId) {
      return updater(node);
    }

    if (node.subMenu.length === 0) return node;

    return {
      ...node,
      subMenu: updateMenuNode(node.subMenu, targetNewId, updater),
    };
  });
}

function mapMenuFunction(item: CoreMenuFunctionItem): MenuFunction {
  return {
    name: item.name,
    path: item.path,
    isActive: item.isActive,
  };
}

export default function SettingsMenuPage() {
  const [data, setData] = useState<MenuSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const [openForm, setOpenForm] = useState(false);
  const [mode, setMode] = useState<"create" | "edit" | "child">("create");
  const [openButtonFunction, setOpenButtonFunction] = useState(false);

  const [selected, setSelected] = useState<MenuSetting | null>(null);
  const [menuName, setMenuName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [seq, setSeq] = useState("");
  const [icon, setIcon] = useState("");
  const [path, setPath] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [buttonFunctionName, setButtonFunctionName] = useState("");
  const [buttonFunctionPath, setButtonFunctionPath] = useState("");

  const menuNameById = useMemo(() => {
    const pairs: Array<readonly [string, string]> = [];
    const visit = (menus: MenuSetting[]) => {
      for (const menu of menus) {
        pairs.push([normalizeMenuId(menu.newId), menu.name] as const);
        if (menu.subMenu.length > 0) visit(menu.subMenu);
      }
    };
    visit(data);
    return new Map(pairs);
  }, [data]);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();
    const matches = (row: MenuSetting) =>
      row.name.toLowerCase().includes(keyword) ||
      row.path.toLowerCase().includes(keyword) ||
      row.createdBy.toLowerCase().includes(keyword);

    const filterTree = (menus: MenuSetting[]): MenuSetting[] =>
      menus
        .map((menu) => {
          const subMenu = filterTree(menu.subMenu);
          return { ...menu, subMenu };
        })
        .filter((menu) => !keyword || matches(menu) || menu.subMenu.length > 0);

    return filterTree(data);
  }, [data, search]);

  const sortMenus = useCallback((menus: MenuSetting[]): MenuSetting[] => {
    return [...menus]
      .sort((left, right) => {
        const leftSeq = left.seq ?? Number.MAX_SAFE_INTEGER;
        const rightSeq = right.seq ?? Number.MAX_SAFE_INTEGER;
        if (leftSeq !== rightSeq) return leftSeq - rightSeq;
        return left.name.localeCompare(right.name);
      })
      .map((menu) => ({
        ...menu,
        subMenu: sortMenus(menu.subMenu),
      }));
  }, []);

  const hierarchicalRows = useMemo(() => sortMenus(filtered), [filtered, sortMenus]);

  const totalPages = Math.ceil(hierarchicalRows.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = hierarchicalRows.slice(startIndex, startIndex + rowsPerPage);
  const totalEntries = hierarchicalRows.length;
  const fromEntry = totalEntries === 0 ? 0 : Math.min(startIndex + 1, totalEntries);
  const toEntry = totalEntries === 0 ? 0 : Math.min(startIndex + rowsPerPage, totalEntries);

  function formatNow() {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
    });

    return formatter.format(new Date()).replace(" ", " ");
  }

  const loadMenus = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const rows = await listCoreMenusMaster(token);
      setData(rows.map(mapMenuSetting));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil data menu.";
      toast.error(message);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenus();
  }, [loadMenus]);

  function resetForm() {
    setMenuName("");
    setParentId(null);
    setSeq("");
    setIcon("");
    setPath("");
    setIsVisible(true);
    setIsActive(true);
    setIsDevelopment(false);
  }

  function handleOpenCreate() {
    setMode("create");
    setSelected(null);
    resetForm();
    setOpenForm(true);
  }

  function handleOpenChildMenu(row: MenuSetting) {
    setMode("child");
    setSelected(row);
    resetForm();
    setParentId(row.newId);
    setOpenForm(true);
  }

  function handleOpenEdit(row: MenuSetting) {
    setMode("edit");
    setSelected(row);
    setMenuName(row.name);
    setParentId(row.parentId);
    setSeq(row.seq?.toString() ?? "");
    setIcon(row.icon);
    setPath(row.path);
    setIsVisible(row.isVisible);
    setIsActive(row.isActive);
    setIsDevelopment(row.isDevelopment);
    setOpenForm(true);
  }

  function handleCloseForm(open: boolean) {
    setOpenForm(open);
    if (!open) {
      setSelected(null);
      resetForm();
    }
  }

  function handleOpenButtonFunction(row: MenuSetting) {
    setSelected(row);
    setButtonFunctionName("");
    setButtonFunctionPath("");
    setOpenButtonFunction(true);
  }

  function handleCloseButtonFunction(open: boolean) {
    setOpenButtonFunction(open);
    if (!open) {
      setSelected(null);
      setButtonFunctionName("");
      setButtonFunctionPath("");
    }
  }

  async function handleCreateButtonFunction() {
    const normalizedName = buttonFunctionName.trim();
    const normalizedPath = buttonFunctionPath.trim();

    if (!selected?.newId) {
      toast.error("Target menu tidak ditemukan.");
      return;
    }

    if (!normalizedName) {
      toast.error("Button name wajib diisi.");
      return;
    }

    const token = getStoredAuthToken() ?? undefined;
    const currentUser = getStoredAuthUser();
    const actor = (currentUser?.name || currentUser?.username || currentUser?.email || "").trim();

    if (!actor) {
      toast.error("User login tidak ditemukan.");
      return;
    }

    setIsSaving(true);
    try {
      await createCoreMenuComponent(
        {
          name: normalizedName,
          menuNewId: selected.newId,
          path: normalizedPath || null,
          createdBy: actor,
          isActiveBtn: true,
        },
        token,
      );

      handleCloseButtonFunction(false);
      toast.success(`Button function "${normalizedName}" berhasil disimpan.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan button function.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreate() {
    const normalizedName = menuName.trim();
    const normalizedSeq = seq.trim();
    const normalizedIcon = icon.trim();
    const normalizedPath = path.trim();

    if (!normalizedName) {
      toast.error("Menu name wajib diisi.");
      return;
    }

    const parsedSeq = normalizedSeq ? Number(normalizedSeq) : null;
    if (normalizedSeq && (parsedSeq === null || !Number.isInteger(parsedSeq) || parsedSeq < 0)) {
      toast.error("Seq harus berupa angka bulat 0 atau lebih.");
      return;
    }

    const token = getStoredAuthToken() ?? undefined;
    const currentUser = getStoredAuthUser();
    const actor = (currentUser?.name || currentUser?.username || currentUser?.email || "").trim();

    if (!actor) {
      toast.error("User login tidak ditemukan.");
      return;
    }

    setIsSaving(true);
    try {
      await createCoreMenu(
        {
          name: normalizedName,
          parentId: mode === "child" ? selected?.newId ?? null : null,
          seq: parsedSeq,
          icon: normalizedIcon || null,
          path: normalizedPath || null,
          isVisible,
          isActive,
          isDevelopment,
          createdBy: actor,
        },
        token,
      );

      setData((prev) => [
        {
          id: Date.now(),
          newId: "",
          name: normalizedName,
          parentId: mode === "child" ? selected?.newId ?? null : null,
          seq: parsedSeq,
          icon: normalizedIcon,
          path: normalizedPath,
          isVisible,
          isActive,
          isDevelopment,
          createdBy: actor,
          createdDate: formatNow(),
          functionBtn: [],
          subMenu: [],
        },
        ...prev,
      ]);
      setPage(1);
      handleCloseForm(false);
      toast.success(`${mode === "child" ? "Child menu" : "Menu"} "${normalizedName}" berhasil disimpan.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan menu.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEdit() {
    if (!selected) return;

    const normalizedName = menuName.trim();
    const normalizedSeq = seq.trim();
    const normalizedIcon = icon.trim();
    const normalizedPath = path.trim();

    if (!normalizedName) {
      toast.error("Menu name wajib diisi.");
      return;
    }

    const parsedSeq = normalizedSeq ? Number(normalizedSeq) : null;
    if (normalizedSeq && (parsedSeq === null || !Number.isInteger(parsedSeq) || parsedSeq < 0)) {
      toast.error("Seq harus berupa angka bulat 0 atau lebih.");
      return;
    }

    if (!selected.newId) {
      toast.error("NewId menu tidak ditemukan.");
      return;
    }

    const token = getStoredAuthToken() ?? undefined;
    const currentUser = getStoredAuthUser();
    const actor = (currentUser?.name || currentUser?.username || currentUser?.email || "").trim();

    if (!actor) {
      toast.error("User login tidak ditemukan.");
      return;
    }

    setIsSaving(true);
    try {
      await updateCoreMenu(
        selected.newId,
        {
          name: normalizedName,
          parentId,
          seq: parsedSeq,
          icon: normalizedIcon || null,
          path: normalizedPath || null,
          isVisible,
          isActive,
          isDevelopment,
          updatedBy: actor,
        },
        token,
      );

      setData((prev) =>
        updateMenuNode(prev, selected.newId, (row) => ({
          ...row,
          name: normalizedName,
          parentId,
          seq: parsedSeq,
          icon: normalizedIcon,
          path: normalizedPath,
          isVisible,
          isActive,
          isDevelopment,
        })),
      );

      handleCloseForm(false);
      toast.success(`Perubahan menu "${normalizedName}" berhasil disimpan.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengubah menu.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6 dark:bg-zinc-900 min-h-screen">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3200,
          style: {
            borderRadius: "18px",
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(15, 23, 42, 0.78)",
            color: "#f8fafc",
            backdropFilter: "blur(18px)",
            boxShadow: "0 20px 60px -24px rgba(15, 23, 42, 0.75)",
            padding: "14px 16px",
          },
        }}
      />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
        <p className="text-sm text-muted-foreground">Manage menu for manufacturing process control and monitoring.</p>
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
            placeholder="Search menu..."
            className="w-full px-9"
          />
        </div>

        <Button className="font-medium" onClick={handleOpenCreate}>
          + Add Menu
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>Menu Name</TableHead>
              <TableHead>Parent Menu</TableHead>
              <TableHead>Seq</TableHead>
              <TableHead>Buttons</TableHead>
              <TableHead>Development</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="w-24 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginated.map((parent) => (
              <Fragment key={parent.newId || `${parent.id}-${parent.name}-${parent.path}`}>
                <TableRow className="transition hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span>{parent.name}</span>
                      {parent.subMenu.length > 0 && (
                        <Badge variant="outline" className="rounded-full font-normal">
                          {parent.subMenu.length} submenus
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{parent.parentId ? menuNameById.get(normalizeMenuId(parent.parentId)) || "Unknown Parent" : "Root"}</TableCell>
                  <TableCell>{parent.seq ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {parent.functionBtn.map((button) => (
                        <Badge key={`${parent.newId}-${button.name}-${button.path}`} variant="secondary" className="font-normal">
                          {button.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {parent.isDevelopment ? <StatusBadge label="Yes" tone="info" /> : <StatusBadge label="No" tone="muted" />}
                  </TableCell>
                  <TableCell>
                    {parent.isActive ? <StatusBadge label="Active" tone="success" /> : <StatusBadge label="Inactive" tone="danger" />}
                  </TableCell>
                  <TableCell>
                    {parent.isVisible ? <StatusBadge label="Visible" tone="info" /> : <StatusBadge label="Hidden" tone="muted" />}
                  </TableCell>
                  <TableCell>{parent.createdBy || "-"}</TableCell>
                  <TableCell>{formatMenuDate(parent.createdDate)}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-3">
                      <Edit className="h-4 w-4 cursor-pointer text-muted-foreground transition hover:text-blue-600" onClick={() => handleOpenEdit(parent)} />
                      <Settings className="h-4 w-4 cursor-pointer text-muted-foreground transition hover:text-amber-600" onClick={() => handleOpenButtonFunction(parent)} />
                      <Plus className="h-4 w-4 cursor-pointer text-muted-foreground transition hover:text-emerald-600" onClick={() => handleOpenChildMenu(parent)} />
                    </div>
                  </TableCell>
                </TableRow>

                {parent.subMenu.map((child) => (
                  <TableRow key={child.newId || `${child.id}-${child.name}-${child.path}`} className="transition hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3 pl-6 text-muted-foreground">
                        <Circle className="h-3.5 w-3.5" />
                        <span className="text-foreground">{child.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{menuNameById.get(normalizeMenuId(child.parentId)) || parent.name}</TableCell>
                    <TableCell>{child.seq ?? "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {child.functionBtn.map((button) => (
                          <Badge key={`${child.newId}-${button.name}-${button.path}`} variant="secondary" className="font-normal">
                            {button.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {child.isDevelopment ? <StatusBadge label="Yes" tone="info" /> : <StatusBadge label="No" tone="muted" />}
                    </TableCell>
                    <TableCell>
                      {child.isActive ? <StatusBadge label="Active" tone="success" /> : <StatusBadge label="Inactive" tone="danger" />}
                    </TableCell>
                    <TableCell>
                      {child.isVisible ? <StatusBadge label="Visible" tone="info" /> : <StatusBadge label="Hidden" tone="muted" />}
                    </TableCell>
                    <TableCell>{child.createdBy || "-"}</TableCell>
                    <TableCell>{formatMenuDate(child.createdDate)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-3">
                        <Edit className="h-4 w-4 cursor-pointer text-muted-foreground transition hover:text-blue-600" onClick={() => handleOpenEdit(child)} />
                        <Settings className="h-4 w-4 cursor-pointer text-muted-foreground transition hover:text-amber-600" onClick={() => handleOpenButtonFunction(child)} />
                        <Plus className="h-4 w-4 cursor-pointer text-muted-foreground transition hover:text-emerald-600" onClick={() => handleOpenChildMenu(child)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}

            {isLoading && (
              <TableRow>
                <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
                  Loading data...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
                  No data found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-2 border-t px-3 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {fromEntry} to {toEntry} of {totalEntries} entries
          </span>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-center text-foreground">
              Page {page} of {totalPages || 1}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages || totalPages === 0} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={openForm} onOpenChange={handleCloseForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add New Menu" : mode === "child" ? "Add Child Menu" : "Edit Menu"}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {mode === "create"
                ? "Create a new menu item. Fill in the details below."
                : mode === "child"
                  ? `Create a child menu under ${selected?.name || "this menu"}.`
                  : "Update the menu item details below."}
            </DialogDescription>
          </DialogHeader>

          {mode === "child" ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="child-menu-name">Menu Name *</Label>
                  <Input id="child-menu-name" value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Enter menu name" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="child-parent-menu">Parent Menu</Label>
                  <Input id="child-parent-menu" value={selected?.name || ""} readOnly disabled />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="child-menu-seq">Sequence *</Label>
                  <Input id="child-menu-seq" type="number" min="0" value={seq} onChange={(e) => setSeq(e.target.value)} placeholder="0" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="child-menu-icon">Icon *</Label>
                  <Input id="child-menu-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Enter icon name" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="child-menu-path">Path *</Label>
                <Input id="child-menu-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="Enter menu path/URL" />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="create-menu-name">Menu Name *</Label>
                <Input id="create-menu-name" value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Enter menu name" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-menu-seq">Sequence *</Label>
                  <Input id="create-menu-seq" type="number" min="0" value={seq} onChange={(e) => setSeq(e.target.value)} placeholder="0" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-menu-icon">Icon *</Label>
                  <Input id="create-menu-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Enter icon name" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-menu-path">Path *</Label>
                <Input id="create-menu-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="Enter menu path/URL" />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label>Is Visible</Label>
                  <p className="text-xs text-muted-foreground">Show this menu in navigation.</p>
                </div>
                <Switch checked={isVisible} onCheckedChange={setIsVisible} />
              </div>

              {mode === "edit" && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <Label>Is Active</Label>
                    <p className="text-xs text-muted-foreground">Enable or disable this menu.</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              )}

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label>Is Development</Label>
                  <p className="text-xs text-muted-foreground">Mark this menu for development only.</p>
                </div>
                <Switch checked={isDevelopment} onCheckedChange={setIsDevelopment} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleCloseForm(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void (mode === "edit" ? handleEdit() : handleCreate())} disabled={isSaving}>
              {isSaving ? "Saving..." : mode === "edit" ? "Update" : mode === "child" ? "Create Child Menu" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openButtonFunction} onOpenChange={handleCloseButtonFunction}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Button Function</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Add a new button. Fill in the details below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="button-function-name">Button Name *</Label>
                <Input
                  id="button-function-name"
                  value={buttonFunctionName}
                  onChange={(e) => setButtonFunctionName(e.target.value)}
                  placeholder="e.g., Edit, Delete, View"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="button-function-menu">Target Menu</Label>
                <Input id="button-function-menu" value={selected?.name || ""} readOnly disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="button-function-path">Button Path/URL</Label>
              <Input
                id="button-function-path"
                value={buttonFunctionPath}
                onChange={(e) => setButtonFunctionPath(e.target.value)}
                placeholder="Enter button path or URL (optional)"
              />
              <p className="text-xs text-muted-foreground">Optional: Specify a custom path or URL for this button function</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleCloseButtonFunction(false)} disabled={isSaving}>
              Close
            </Button>
            <Button onClick={() => void handleCreateButtonFunction()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Add Button Function"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
