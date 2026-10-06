"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ChevronLeft, ChevronRight, Download, Info, Search, SquarePen, Upload } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken, getStoredAuthUser } from "@/lib/api/auth";
import { createMstCubstool, listMstCubstools, type MstCubstoolItem, updateMstCubstool } from "@/lib/api/mst-cubstool";

function formatDimensions(row: Pick<MstCubstoolItem, "length" | "width" | "height">) {
  return [row.length, row.width, row.height].map((value) => value.trim() || "-").join(" x ");
}

function formatCreatedDate(value: string) {
  if (!value || value === "-") return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

type ImportCubstoolRow = {
  name: string;
  itemCode: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  color: string;
};

function normalizeImportHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("#")) return trimmed.toUpperCase();
  return `#${trimmed}`.toUpperCase();
}

function parseImportRows(file: File) {
  return new Promise<ImportCubstoolRow[]>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error("Sheet Excel tidak ditemukan."));
          return;
        }

        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
          header: 1,
          raw: false,
          defval: "",
        });

        if (rows.length < 2) {
          reject(new Error("File Excel tidak memiliki data untuk diimport."));
          return;
        }

        const headerRow = rows[0] ?? [];
        const headerMap = new Map(headerRow.map((header, index) => [normalizeImportHeader(header), index] as const));
        const requiredHeaders = ["name", "itemcode", "length", "width", "height", "weight", "color"];
        const missingHeaders = requiredHeaders.filter((header) => !headerMap.has(header));

        if (missingHeaders.length > 0) {
          reject(new Error(`Header Excel tidak lengkap. Header wajib: Name, Item Code, Length, Width, Height, Weight, Color.`));
          return;
        }

        const parsedRows = rows
          .slice(1)
          .map((row) => ({
            name: normalizeCellValue(row[headerMap.get("name") ?? -1]),
            itemCode: normalizeCellValue(row[headerMap.get("itemcode") ?? -1]),
            length: normalizeCellValue(row[headerMap.get("length") ?? -1]),
            width: normalizeCellValue(row[headerMap.get("width") ?? -1]),
            height: normalizeCellValue(row[headerMap.get("height") ?? -1]),
            weight: normalizeCellValue(row[headerMap.get("weight") ?? -1]),
            color: normalizeCellValue(row[headerMap.get("color") ?? -1]),
          }))
          .filter((row) => Object.values(row).some((value) => value.length > 0));

        if (parsedRows.length === 0) {
          reject(new Error("Tidak ada baris data yang valid untuk diimport."));
          return;
        }

        resolve(parsedRows);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Gagal membaca file Excel."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Gagal membaca file Excel."));
    };

    reader.readAsArrayBuffer(file);
  });
}

export default function CubstoolPage() {
  const [data, setData] = useState<MstCubstoolItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const [openForm, setOpenForm] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingNewId, setEditingNewId] = useState("");

  const [name, setName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [colorPickerValue, setColorPickerValue] = useState("#3b82f6");
  const [isActive, setIsActive] = useState(true);

  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

  const loadCubstools = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const rows = await listMstCubstools(token);
      setData(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil data cubstool.";
      toast.error(message);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCubstools();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCubstools]);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();
    return data.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.itemCode.toLowerCase().includes(keyword) ||
        item.createdBy.toLowerCase().includes(keyword),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  function resetForm() {
    setEditingNewId("");
    setName("");
    setItemCode("");
    setLength("");
    setWidth("");
    setHeight("");
    setWeight("");
    setColorPickerValue("#3b82f6");
    setIsActive(true);
  }

  function openCreate() {
    setMode("create");
    resetForm();
    setOpenForm(true);
  }

  function openEdit(row: MstCubstoolItem) {
    setMode("edit");
    setEditingNewId(row.newId);
    setName(row.name);
    setItemCode(row.itemCode);
    setLength(row.length);
    setWidth(row.width);
    setHeight(row.height);
    setWeight(row.weight);
    setIsActive(row.isActive);
    if (HEX_COLOR_REGEX.test(row.color)) {
      setColorPickerValue(row.color);
    } else {
      setColorPickerValue("#3b82f6");
    }
    setOpenForm(true);
  }

  async function handleSave() {
    const normalizedName = name.trim();
    const normalizedItemCode = itemCode.trim().toUpperCase();
    const normalizedLength = length.trim();
    const normalizedWidth = width.trim();
    const normalizedHeight = height.trim();
    const normalizedWeight = weight.trim();
    const normalizedColor = normalizeHexColor(colorPickerValue);

    if (!normalizedName || !normalizedItemCode) {
      toast.error("Name dan Item Code wajib diisi.");
      return;
    }

    if (!HEX_COLOR_REGEX.test(normalizedColor)) {
      toast.error("Color wajib diisi dengan format warna yang valid.");
      return;
    }

    if (mode === "edit" && !editingNewId) {
      toast.error("NewId cubstool tidak ditemukan.");
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
      const payload = {
        name: normalizedName,
        itemCode: normalizedItemCode,
        length: normalizedLength,
        width: normalizedWidth,
        height: normalizedHeight,
        weight: normalizedWeight,
        color: normalizedColor,
        createdBy: actor,
        isActive: true,
      };

      if (mode === "create") {
        await createMstCubstool(payload, token);
      } else {
        await updateMstCubstool(editingNewId, { ...payload, isActive }, token);
      }

      await loadCubstools();
      setPage(1);
      setOpenForm(false);
      resetForm();
      toast.success(mode === "create" ? `Cubstool "${normalizedName}" berhasil ditambahkan.` : `Cubstool "${normalizedName}" berhasil diperbarui.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : mode === "create" ? "Gagal menyimpan cubstool." : "Gagal memperbarui cubstool.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleFileSelect(file?: File | null) {
    setImportError(null);
    if (!file) {
      setImportFile(null);
      return;
    }

    const fileName = file.name.toLowerCase();
    if (!(fileName.endsWith(".xls") || fileName.endsWith(".xlsx"))) {
      setImportError("Hanya file .xls / .xlsx yang diperbolehkan.");
      setImportFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setImportError("Ukuran file maksimal 5MB.");
      setImportFile(null);
      return;
    }

    setImportFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileSelect(file);
  }

  async function handleImport() {
    if (!importFile) {
      setImportError("Pilih file terlebih dahulu.");
      return;
    }

    const token = getStoredAuthToken() ?? undefined;
    const currentUser = getStoredAuthUser();
    const actor = (currentUser?.name || currentUser?.username || currentUser?.email || "").trim();

    if (!actor) {
      setImportError("User login tidak ditemukan.");
      return;
    }

    setIsImporting(true);
    try {
      const rows = await parseImportRows(importFile);
      let successCount = 0;
      const errors: string[] = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const normalizedName = row.name.trim();
        const normalizedItemCode = row.itemCode.trim().toUpperCase();
        const normalizedColor = normalizeHexColor(row.color);

        if (!normalizedName || !normalizedItemCode) {
          errors.push(`Baris ${index + 2}: Name dan Item Code wajib diisi.`);
          continue;
        }

        if (!HEX_COLOR_REGEX.test(normalizedColor)) {
          errors.push(`Baris ${index + 2}: Color harus berupa hex valid, misalnya #1B1B1B.`);
          continue;
        }

        try {
          await createMstCubstool(
            {
              name: normalizedName,
              itemCode: normalizedItemCode,
              length: row.length.trim(),
              width: row.width.trim(),
              height: row.height.trim(),
              weight: row.weight.trim(),
              color: normalizedColor,
              createdBy: actor,
              isActive: true,
            },
            token,
          );
          successCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Gagal import data.";
          errors.push(`Baris ${index + 2}: ${message}`);
        }
      }

      await loadCubstools();
      setPage(1);

      if (successCount > 0 && errors.length === 0) {
        setOpenImport(false);
        setImportFile(null);
        setImportError(null);
        toast.success(`${successCount} data cubstool berhasil diimport.`);
        return;
      }

      if (successCount > 0 && errors.length > 0) {
        toast.success(`${successCount} data berhasil diimport. ${errors.length} data gagal.`);
        setImportError(errors.slice(0, 5).join("\n"));
        return;
      }

      setImportError(errors.slice(0, 5).join("\n") || "Tidak ada data yang berhasil diimport.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengunggah file.";
      setImportError(message);
    } finally {
      setIsImporting(false);
    }
  }

  function handleDownloadTemplate() {
    const rows = [
      ["Name", "Item Code", "Length", "Width", "Height", "Weight", "Color"],
      ["Example Cubstool A", "CUB001", 10, 5, 3, "2 kg", "Red"],
      ["Example Cubstool B", "CUB002", 12, 6, 4, "2.5 kg", "Blue"],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cubstool Template");
    XLSX.writeFile(workbook, "master-cubstool-template.xlsx");
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Master Cubstool</h1>
        <p className="text-sm text-muted-foreground">Manage cubstool master data.</p>
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
            placeholder="Search name, item code, or creator..."
            className="w-full rounded-md px-9 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setOpenImport(true)} variant="outline" className="font-medium">
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button onClick={openCreate} className="font-medium">
            + Add Cubstool
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Dimensions (L x W x H)</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Is Active</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="w-24 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginated.map((row) => (
              <TableRow key={row.newId || `${row.id}-${row.itemCode}-${row.name}`}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.itemCode}</TableCell>
                <TableCell>{formatDimensions(row)}</TableCell>
                <TableCell>{row.weight || "-"}</TableCell>
                <TableCell>{row.color || "-"}</TableCell>
                <TableCell>
                  {row.isActive ? (
                    <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell>{row.createdBy || "-"}</TableCell>
                <TableCell>{formatCreatedDate(row.createdDate)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-3">
                    <SquarePen className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-blue-600" onClick={() => openEdit(row)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                  Loading data...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                  No data found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-2 border-t px-3 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {Math.min(startIndex + 1, filtered.length || 0)} to {Math.min(startIndex + rowsPerPage, filtered.length)} of {filtered.length} entries
          </span>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-24 text-center">
              Page {page} of {totalPages}
            </span>

            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add Cubstool" : "Edit Cubstool"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Input name" />
            </div>

            <div className="space-y-1">
              <Label>Item Code</Label>
              <Input value={itemCode} onChange={(e) => setItemCode(e.target.value)} placeholder="Input item code" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Length</Label>
                <Input value={length} onChange={(e) => setLength(e.target.value)} placeholder="e.g. 10" />
              </div>

              <div className="space-y-1">
                <Label>Width</Label>
                <Input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="e.g. 5" />
              </div>

              <div className="space-y-1">
                <Label>Height</Label>
                <Input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 3" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Weight</Label>
              <Input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 2 kg" />
            </div>

            <div className="space-y-1">
              <Label>Color</Label>
              <div className="space-y-2">
                <Input
                  type="color"
                  value={colorPickerValue}
                  onChange={(e) => {
                    const nextColor = e.target.value;
                    setColorPickerValue(nextColor);
                  }}
                  className="h-11 cursor-pointer p-1"
                />
                <div className="text-xs text-muted-foreground">{colorPickerValue.toUpperCase()}</div>
              </div>
            </div>

            {mode === "edit" && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label>Is Active</Label>
                  <p className="text-xs text-muted-foreground">Aktifkan atau nonaktifkan data cubstool.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Saving..." : mode === "create" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openImport}
        onOpenChange={(open) => {
          setOpenImport(open);
          if (!open) {
            setImportFile(null);
            setImportError(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Import from Excel</DialogTitle>
            Upload an Excel file (.xlsx, .xls) to bulk import cubstools.
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="rounded-md border-blue-100 bg-blue-50 p-3">
              <Info className="h-4 w-4 text-blue-700" />
              <AlertDescription>
                <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm leading-relaxed text-blue-700">Make sure to use the correct format.</div>
                  <button type="button" onClick={handleDownloadTemplate} className="inline-flex w-fit shrink-0 items-center gap-1 text-sm text-blue-700">
                    <Download className="h-3 w-3" />
                    <span className="font-medium">Download Template</span>
                  </button>
                </div>
              </AlertDescription>
            </Alert>

            <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="rounded-md border-2 border-dashed border-blue-400 bg-blue-50 p-6 text-center">
              <div className="flex flex-col items-center">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-blue-200 bg-blue-100">
                  <Upload className="h-7 w-7 text-blue-600" />
                </div>
                <div className="text-sm">Click to upload or drag and drop</div>
                <div className="text-xs text-muted-foreground">Excel files only (max 5MB)</div>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                  className="hidden"
                  id="cubstool-import-file"
                />
                <label htmlFor="cubstool-import-file" className="mt-3 inline-block cursor-pointer text-sm underline">
                  Choose file
                </label>
              </div>
            </div>

            {importFile && <div className="text-sm">Selected: {importFile.name}</div>}
            {importError && <div className="text-sm text-destructive">{importError}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenImport(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={() => void handleImport()} disabled={isImporting}>
              {isImporting ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
