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
import { createMstVehicle, getMstVehicleById, listMstVehicles, type MstVehicleItem, updateMstVehicle } from "@/lib/api/mst-vehicle";

function formatDimensions(row: Pick<MstVehicleItem, "dimensionsL" | "dimensionsW">) {
  return [row.dimensionsL, row.dimensionsW].map((value) => value.trim() || "-").join(" x ");
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

type ImportVehicleRow = {
  name: string;
  type: string;
  climate: string;
  cbm: string;
  dimensionsL: string;
  dimensionsW: string;
  floorArea: string;
  maxHeight: string;
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

function parseImportRows(file: File) {
  return new Promise<ImportVehicleRow[]>((resolve, reject) => {
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
        const requiredHeaders = ["name", "type", "climate", "cbm", "dimensionslm", "dimensionswm", "flooraream2", "maxheightm"];
        const missingHeaders = requiredHeaders.filter((header) => !headerMap.has(header));

        if (missingHeaders.length > 0) {
          reject(new Error("Header Excel tidak lengkap. Header wajib: Name, Type, Climate, CBM, Dimensions_L_m, Dimensions_W_m, FloorArea_m2, MaxHeight_m."));
          return;
        }

        const parsedRows = rows
          .slice(1)
          .map((row) => ({
            name: normalizeCellValue(row[headerMap.get("name") ?? -1]),
            type: normalizeCellValue(row[headerMap.get("type") ?? -1]),
            climate: normalizeCellValue(row[headerMap.get("climate") ?? -1]),
            cbm: normalizeCellValue(row[headerMap.get("cbm") ?? -1]),
            dimensionsL: normalizeCellValue(row[headerMap.get("dimensionslm") ?? -1]),
            dimensionsW: normalizeCellValue(row[headerMap.get("dimensionswm") ?? -1]),
            floorArea: normalizeCellValue(row[headerMap.get("flooraream2") ?? -1]),
            maxHeight: normalizeCellValue(row[headerMap.get("maxheightm") ?? -1]),
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

export default function VehiclePage() {
  const [data, setData] = useState<MstVehicleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const [openForm, setOpenForm] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingNewId, setEditingNewId] = useState("");

  const [name, setName] = useState("");
  const [typeField, setTypeField] = useState("");
  const [climate, setClimate] = useState("");
  const [cbm, setCbm] = useState("");
  const [dimensionsL, setDimensionsL] = useState("");
  const [dimensionsW, setDimensionsW] = useState("");
  const [floorArea, setFloorArea] = useState("");
  const [maxHeight, setMaxHeight] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const loadVehicles = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const rows = await listMstVehicles(token);
      setData(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil data vehicle.";
      toast.error(message);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadVehicles();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadVehicles]);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();
    return data.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.type.toLowerCase().includes(keyword) ||
        item.climate.toLowerCase().includes(keyword) ||
        item.createdBy.toLowerCase().includes(keyword),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  function resetForm() {
    setEditingNewId("");
    setName("");
    setTypeField("");
    setClimate("");
    setCbm("");
    setDimensionsL("");
    setDimensionsW("");
    setFloorArea("");
    setMaxHeight("");
    setIsActive(true);
  }

  function openCreate() {
    setMode("create");
    resetForm();
    setOpenForm(true);
  }

  async function openEdit(row: MstVehicleItem) {
    setMode("edit");
    setEditingNewId(row.newId);
    setOpenForm(true);
    setIsSaving(true);

    try {
      const token = getStoredAuthToken() ?? undefined;
      const detail = await getMstVehicleById(row.newId, token);
      const source = detail ?? row;

      setName(source.name);
      setTypeField(source.type);
      setClimate(source.climate);
      setCbm(source.cbm);
      setDimensionsL(source.dimensionsL);
      setDimensionsW(source.dimensionsW);
      setFloorArea(source.floorArea);
      setMaxHeight(source.maxHeight);
      setIsActive(source.isActive);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil detail vehicle.";
      toast.error(message);
      setOpenForm(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    const normalizedName = name.trim();
    const normalizedType = typeField.trim();
    const normalizedClimate = climate.trim();
    const normalizedCbm = cbm.trim();
    const normalizedDimensionsL = dimensionsL.trim();
    const normalizedDimensionsW = dimensionsW.trim();
    const normalizedFloorArea = floorArea.trim();
    const normalizedMaxHeight = maxHeight.trim();

    if (!normalizedName) {
      toast.error("Name wajib diisi.");
      return;
    }

    if (mode === "edit" && !editingNewId) {
      toast.error("NewId vehicle tidak ditemukan.");
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
        type: normalizedType || undefined,
        climate: normalizedClimate || undefined,
        cbm: normalizedCbm || undefined,
        dimensions_L_m: normalizedDimensionsL || undefined,
        dimensions_W_m: normalizedDimensionsW || undefined,
        floorArea_m2: normalizedFloorArea || undefined,
        maxHeight_m: normalizedMaxHeight || undefined,
        isActive,
        createdBy: actor,
      };

      if (mode === "create") {
        await createMstVehicle(payload, token);
      } else {
        await updateMstVehicle(editingNewId, payload, token);
      }

      await loadVehicles();
      setPage(1);
      setOpenForm(false);
      resetForm();
      toast.success(mode === "create" ? `Vehicle "${normalizedName}" berhasil ditambahkan.` : `Vehicle "${normalizedName}" berhasil diperbarui.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : mode === "create" ? "Gagal menyimpan vehicle." : "Gagal memperbarui vehicle.";
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

        if (!normalizedName) {
          errors.push(`Baris ${index + 2}: Name wajib diisi.`);
          continue;
        }

        try {
          await createMstVehicle(
            {
              name: normalizedName,
              type: row.type.trim() || undefined,
              climate: row.climate.trim() || undefined,
              cbm: row.cbm.trim() || undefined,
              dimensions_L_m: row.dimensionsL.trim() || undefined,
              dimensions_W_m: row.dimensionsW.trim() || undefined,
              floorArea_m2: row.floorArea.trim() || undefined,
              maxHeight_m: row.maxHeight.trim() || undefined,
              isActive: true,
              createdBy: actor,
            },
            token,
          );
          successCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Gagal import data.";
          errors.push(`Baris ${index + 2}: ${message}`);
        }
      }

      await loadVehicles();
      setPage(1);

      if (successCount > 0 && errors.length === 0) {
        setOpenImport(false);
        setImportFile(null);
        setImportError(null);
        toast.success(`${successCount} data vehicle berhasil diimport.`);
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
      ["Name", "Type", "Climate", "CBM", "Dimensions_L_m", "Dimensions_W_m", "FloorArea_m2", "MaxHeight_m"],
      ["Example Truck", "Box Truck", "NON_AC", 25, 6, 2.4, 14.4, 2.5],
      ["Example Reefer", "Refrigerated", "AC", 20, 5.5, 2.3, 12.65, 2.4],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vehicle Template");
    XLSX.writeFile(workbook, "master-vehicle-template.xlsx");
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Master Vehicle</h1>
        <p className="text-sm text-muted-foreground">Manage vehicle master data.</p>
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
            placeholder="Search name, type, climate, or creator..."
            className="w-full rounded-md px-9 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setOpenImport(true)} variant="outline" className="font-medium">
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button onClick={openCreate} className="font-medium">
            + Add Vehicle
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Climate</TableHead>
              <TableHead>CBM</TableHead>
              <TableHead>Dimensions (L x W m)</TableHead>
              <TableHead>Floor Area (m2)</TableHead>
              <TableHead>Max Height (m)</TableHead>
              <TableHead>Is Active</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="w-24 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginated.map((row) => (
              <TableRow key={row.newId || `${row.id}-${row.name}`}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.type || "-"}</TableCell>
                <TableCell>{row.climate || "-"}</TableCell>
                <TableCell>{row.cbm || "-"}</TableCell>
                <TableCell>{formatDimensions(row)}</TableCell>
                <TableCell>{row.floorArea || "-"}</TableCell>
                <TableCell>{row.maxHeight || "-"}</TableCell>
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
                  <div className="flex items-center justify-center">
                    <SquarePen className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-blue-600" onClick={() => void openEdit(row)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {isLoading && (
              <TableRow>
                <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">
                  Loading data...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add Vehicle" : "Edit Vehicle"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Input name" disabled={isSaving && mode === "edit"} />
            </div>

            <div className="space-y-1">
              <Label>Type</Label>
              <Input value={typeField} onChange={(e) => setTypeField(e.target.value)} placeholder="Input type" disabled={isSaving && mode === "edit"} />
            </div>

            <div className="space-y-1">
              <Label>Climate</Label>
              <select
                value={climate}
                onChange={(e) => setClimate(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={isSaving && mode === "edit"}
              >
                <option value="">Select climate</option>
                <option value="AC">AC</option>
                <option value="NON_AC">NON_AC</option>
                <option value="Non-AC">Non-AC</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>CBM</Label>
              <Input value={cbm} onChange={(e) => setCbm(e.target.value)} placeholder="e.g. 12.5" disabled={isSaving && mode === "edit"} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Dimensions L (m)</Label>
                <Input value={dimensionsL} onChange={(e) => setDimensionsL(e.target.value)} placeholder="e.g. 6" disabled={isSaving && mode === "edit"} />
              </div>

              <div className="space-y-1">
                <Label>Dimensions W (m)</Label>
                <Input value={dimensionsW} onChange={(e) => setDimensionsW(e.target.value)} placeholder="e.g. 2.4" disabled={isSaving && mode === "edit"} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Floor Area (m2)</Label>
              <Input value={floorArea} onChange={(e) => setFloorArea(e.target.value)} placeholder="e.g. 14.4" disabled={isSaving && mode === "edit"} />
            </div>

            <div className="space-y-1">
              <Label>Max Height (m)</Label>
              <Input value={maxHeight} onChange={(e) => setMaxHeight(e.target.value)} placeholder="e.g. 2.6" disabled={isSaving && mode === "edit"} />
            </div>

            {mode === "edit" && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label>Is Active</Label>
                  <p className="text-xs text-muted-foreground">Aktifkan atau nonaktifkan data vehicle.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} disabled={isSaving} />
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
            Upload an Excel file (.xlsx, .xls) to bulk import vehicles.
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
                  id="vehicle-import-file"
                />
                <label htmlFor="vehicle-import-file" className="mt-3 inline-block cursor-pointer text-sm underline">
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
