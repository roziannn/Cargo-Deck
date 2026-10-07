"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Trash2,
  Truck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { TruckScene, type CameraPreset } from "@/components/truck-scene";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getStoredAuthToken } from "@/lib/api/auth";
import { listMstCubstools, type MstCubstoolItem } from "@/lib/api/mst-cubstool";
import { getMstVehicleById, listVehicleLov, type VehicleLovItem } from "@/lib/api/mst-vehicle";
import { getShippingPlan, saveShippingPlanLoad, type ShippingPlanDetail } from "@/lib/api/shipping-plan";
import { cargoBinFor, packCargo, type PackBox } from "@/lib/cargo-packing";
import { cn } from "@/lib/utils";

type SelectedProductItem = {
  id: string;
  value: string; // cubstool newId
  label: string;
  count: string;
  color: string; // tailwind bg class
  colorHex: string;
};

type ProductSpec = {
  /** Carton size in metres. */
  l: number;
  w: number;
  h: number;
  weightKg: number;
  code: string;
  /** False when the master data has no usable dimensions and a default carton is used. */
  hasDimensions: boolean;
};

type VehicleInfo = {
  name: string;
  type: string;
  climate: string;
  length: number;
  width: number;
  height: number;
  maxPayload: number | null;
};

const PRODUCT_COLORS = [
  { badgeClass: "bg-cyan-400", hex: "#22d3ee" },
  { badgeClass: "bg-lime-500", hex: "#84cc16" },
  { badgeClass: "bg-amber-400", hex: "#fbbf24" },
  { badgeClass: "bg-rose-400", hex: "#fb7185" },
  { badgeClass: "bg-violet-400", hex: "#a78bfa" },
  { badgeClass: "bg-sky-500", hex: "#0ea5e9" },
  { badgeClass: "bg-orange-400", hex: "#fb923c" },
  { badgeClass: "bg-emerald-400", hex: "#34d399" },
];

const DEFAULT_VEHICLE: VehicleInfo = { name: "", type: "", climate: "", length: 6, width: 2.4, height: 2.5, maxPayload: null };
// used when a product has no usable dimensions in the master data (metres)
const DEFAULT_CARTON = { l: 0.4, w: 0.3, h: 0.25 };
const DRAFT_KEY = "shipping-container-load-create-draft";

const VIEWS: { key: CameraPreset; label: string }[] = [
  { key: "iso", label: "3D" },
  { key: "side", label: "Side" },
  { key: "top", label: "Top" },
  { key: "rear", label: "Rear" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function positive(value: string | undefined, fallback: number) {
  const parsed = Number((value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getProductColorToken(value: string) {
  const seed = value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PRODUCT_COLORS[seed % PRODUCT_COLORS.length];
}

function createSelectedItem(product: { value: string; label: string }): SelectedProductItem {
  const token = getProductColorToken(product.value);
  return {
    id: `${product.value}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    value: product.value,
    label: product.label,
    count: "1",
    color: token.badgeClass,
    colorHex: token.hex,
  };
}

function sanitizeCountInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 5);
}

function parseCount(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

const fmtCm = (m: number) => Math.round(m * 100);
const fmtKg = (kg: number) => `${+kg.toFixed(1)} kg`;

function toPackBoxes(items: SelectedProductItem[], specs: Record<string, ProductSpec>): PackBox[] {
  return items.flatMap((item) => {
    const spec = specs[item.value];
    const l = spec?.l ?? DEFAULT_CARTON.l;
    const w = spec?.w ?? DEFAULT_CARTON.w;
    const h = spec?.h ?? DEFAULT_CARTON.h;
    return Array.from({ length: parseCount(item.count) }, (_, i) => ({
      id: `${item.id}-${i}`,
      productKey: item.id,
      color: item.colorHex,
      l,
      w,
      h,
      // heavier cartons are packed first so they end up on the floor, lighter ones above them
      weight: spec?.weightKg ?? 0,
    }));
  });
}

function loadDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { zoom?: number; selectedContainerType?: string; selectedItems?: SelectedProductItem[] };
    return {
      zoom: typeof parsed.zoom === "number" ? clamp(parsed.zoom, 0.7, 2) : 1.2,
      selectedContainerType: typeof parsed.selectedContainerType === "string" ? parsed.selectedContainerType : "",
      selectedItems: (Array.isArray(parsed.selectedItems) ? parsed.selectedItems : []).filter(
        (item): item is SelectedProductItem =>
          Boolean(item) &&
          typeof item.id === "string" &&
          typeof item.value === "string" &&
          typeof item.label === "string" &&
          typeof item.count === "string" &&
          typeof item.color === "string" &&
          typeof item.colorHex === "string",
      ),
    };
  } catch {
    return null;
  }
}

export default function ShippingPage() {
  return (
    <Suspense fallback={null}>
      <ShippingSimulation />
    </Suspense>
  );
}

function ShippingSimulation() {
  const router = useRouter();
  const planId = useSearchParams().get("planId");
  // With a plan, the plan itself is the source of truth; the browser draft only applies to standalone use.
  const initialDraft = planId ? null : loadDraft();

  const [zoom, setZoom] = useState(initialDraft?.zoom ?? 1.2);
  const [view, setView] = useState<CameraPreset>("iso");
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const [vehicles, setVehicles] = useState<VehicleLovItem[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialDraft?.selectedContainerType ?? "");
  const [vehicle, setVehicle] = useState<VehicleInfo>(DEFAULT_VEHICLE);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [openVehicle, setOpenVehicle] = useState(false);

  const [products, setProducts] = useState<MstCubstoolItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [openProduct, setOpenProduct] = useState(false);
  const [selectedItems, setSelectedItems] = useState<SelectedProductItem[]>(initialDraft?.selectedItems ?? []);
  const [hoverItem, setHoverItem] = useState<string | null>(null);

  const [plan, setPlan] = useState<ShippingPlanDetail | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // ---- data loading ----
  useEffect(() => {
    if (!planId) return;
    let alive = true;

    getShippingPlan(planId, getStoredAuthToken() ?? undefined)
      .then((detail) => {
        if (!alive) return;
        setPlan(detail);
        if (detail.vehicleNewId) setSelectedVehicleId(detail.vehicleNewId);
        if (detail.items.length > 0) {
          setSelectedItems(
            detail.items.map((item) => ({ ...createSelectedItem({ value: item.cubstoolNewId, label: item.itemName }), count: String(item.qty) })),
          );
        }
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal mengambil shipping plan."));

    return () => {
      alive = false;
    };
  }, [planId]);

  useEffect(() => {
    let alive = true;

    listVehicleLov(getStoredAuthToken() ?? undefined)
      .then((rows) => {
        if (!alive) return;
        setVehicles(rows);
        setSelectedVehicleId((current) => (current && rows.some((row) => row.value === current) ? current : (rows[0]?.value ?? "")));
      })
      .catch((error) => {
        if (!alive) return;
        setVehicles([]);
        setVehicleError(error instanceof Error ? error.message : "Gagal mengambil data kendaraan.");
      })
      .finally(() => alive && setIsLoadingVehicles(false));

    listMstCubstools(getStoredAuthToken() ?? undefined)
      .then((rows) => alive && setProducts(rows.filter((row) => row.isActive)))
      .catch((error) => alive && setProductError(error instanceof Error ? error.message : "Gagal mengambil data produk."))
      .finally(() => alive && setIsLoadingProducts(false));

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadVehicle() {
      if (!selectedVehicleId) {
        setVehicle(DEFAULT_VEHICLE);
        return;
      }

      setIsLoadingVehicle(true);
      setVehicleError(null);
      try {
        const detail = await getMstVehicleById(selectedVehicleId, getStoredAuthToken() ?? undefined);
        if (!alive) return;
        if (!detail) {
          setVehicle(DEFAULT_VEHICLE);
          setVehicleError("Detail kendaraan tidak ditemukan.");
          return;
        }
        const payload = Number(detail.maxPayload);
        setVehicle({
          name: detail.name,
          type: detail.type,
          climate: detail.climate,
          length: positive(detail.dimensionsL, DEFAULT_VEHICLE.length),
          width: positive(detail.dimensionsW, DEFAULT_VEHICLE.width),
          height: positive(detail.maxHeight, DEFAULT_VEHICLE.height),
          maxPayload: payload > 0 ? payload : null,
        });
      } catch (error) {
        if (!alive) return;
        setVehicle(DEFAULT_VEHICLE);
        setVehicleError(error instanceof Error ? error.message : "Gagal mengambil detail kendaraan.");
      } finally {
        if (alive) setIsLoadingVehicle(false);
      }
    }

    void loadVehicle();

    return () => {
      alive = false;
    };
  }, [selectedVehicleId]);

  // ---- derived data ----
  const specs = useMemo(() => {
    const map: Record<string, ProductSpec> = {};
    for (const row of products) {
      const l = Number(row.length) / 100;
      const w = Number(row.width) / 100;
      const h = Number(row.height) / 100;
      const hasDimensions = l > 0 && w > 0 && h > 0;
      map[row.newId] = {
        l: hasDimensions ? l : DEFAULT_CARTON.l,
        w: hasDimensions ? w : DEFAULT_CARTON.w,
        h: hasDimensions ? h : DEFAULT_CARTON.h,
        weightKg: Number(row.weight) > 0 ? Number(row.weight) : 0,
        code: row.itemCode,
        hasDimensions,
      };
    }
    return map;
  }, [products]);

  const bin = useMemo(() => cargoBinFor(vehicle), [vehicle]);
  const layout = useMemo(() => packCargo(toPackBoxes(selectedItems, specs), bin), [selectedItems, specs, bin]);

  const totalUnits = selectedItems.reduce((sum, item) => sum + parseCount(item.count), 0);
  const totalWeightKg = selectedItems.reduce((sum, item) => sum + parseCount(item.count) * (specs[item.value]?.weightKg ?? 0), 0);
  const notLoaded = layout.unplaced.length;
  const loadedWeightKg = layout.placed.reduce((sum, box) => sum + (box.weight ?? 0), 0);
  const isOverweight = vehicle.maxPayload !== null && totalWeightKg > vehicle.maxPayload;
  const planLocked = plan !== null && plan.status !== "DRAFT" && plan.status !== "PLANNED";
  const selectedVehicleLabel = vehicles.find((item) => item.value === selectedVehicleId)?.label ?? "";
  const missingDimensions = selectedItems.filter((item) => specs[item.value] && !specs[item.value].hasDimensions);

  const fits = (items: SelectedProductItem[]) => packCargo(toPackBoxes(items, specs), bin).unplaced.length === 0;

  // ---- item handlers ----
  function handleAddProduct(product: MstCubstoolItem) {
    const existing = selectedItems.find((item) => item.value === product.newId);
    const next = existing
      ? selectedItems.map((item) => (item.id === existing.id ? { ...item, count: String(parseCount(item.count) + 1) } : item))
      : [...selectedItems, createSelectedItem({ value: product.newId, label: product.name })];

    if (!fits(next)) {
      toast.error("Kendaraan sudah penuh. Produk ini tidak muat lagi.");
      return;
    }
    setSelectedItems(next);
  }

  function setItemCount(id: string, requested: number) {
    const current = selectedItems.find((item) => item.id === id);
    if (!current) return;
    const previous = parseCount(current.count);
    const apply = (count: number) =>
      setSelectedItems((items) => items.map((item) => (item.id === id ? { ...item, count: String(count) } : item)).filter((item) => parseCount(item.count) > 0));

    if (requested <= previous || fits(selectedItems.map((item) => (item.id === id ? { ...item, count: String(requested) } : item)))) {
      apply(requested);
      return;
    }

    // the requested amount does not fit: find the most that does
    let lo = previous;
    let hi = requested;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(selectedItems.map((item) => (item.id === id ? { ...item, count: String(mid) } : item)))) lo = mid;
      else hi = mid - 1;
    }
    apply(lo);
    toast.error(`Hanya muat ${lo} unit untuk produk ini di kendaraan terpilih.`);
  }

  // ---- saving ----
  async function handleSavePlanLoad() {
    if (!planId || planLocked) return;
    if (!selectedVehicleId) return void toast.error("Pilih kendaraan terlebih dahulu.");
    if (selectedItems.length === 0) return void toast.error("Tambahkan minimal satu produk sebelum menyimpan.");
    if (notLoaded > 0) return void toast.error(`${notLoaded} unit tidak muat di kendaraan. Kurangi jumlah atau pilih kendaraan lain.`);

    setIsSavingPlan(true);
    try {
      const qtyByProduct = new Map<string, number>();
      for (const item of selectedItems) qtyByProduct.set(item.value, (qtyByProduct.get(item.value) ?? 0) + parseCount(item.count));

      await saveShippingPlanLoad(
        planId,
        {
          vehicleNewId: selectedVehicleId,
          utilizationPct: Math.round(layout.volumePct * 100) / 100,
          items: [...qtyByProduct].map(([cubstoolNewId, qty]) => ({ cubstoolNewId, qty })),
        },
        getStoredAuthToken() ?? undefined,
      );
      if (isOverweight) toast("Plan tersimpan, tetapi berat melebihi max payload kendaraan.", { icon: "⚠️" });
      else toast.success("Load simulation tersimpan ke shipping plan.");
      router.push(`/shipping/plan/${planId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan ke shipping plan.");
      setIsSavingPlan(false);
    }
  }

  function handleSaveDraft() {
    if (!selectedVehicleId) return void toast.error("Pilih kendaraan terlebih dahulu.");
    if (selectedItems.length === 0) return void toast.error("Tambahkan minimal satu produk sebelum menyimpan.");
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ zoom, selectedContainerType: selectedVehicleId, selectedItems }));
    toast.success("Layout disimpan di browser ini. Buka dari Shipping Plan untuk menyimpan permanen.");
  }

  const volumeTone = layout.volumePct > 95 ? "bg-red-500" : layout.volumePct > 80 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="relative flex h-full min-h-0 min-w-0 overflow-hidden">
      <Toaster position="top-center" />

      {/* ---------------- left panel ---------------- */}
      <aside
        className={cn(
          "flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-300 ease-out dark:border-slate-800 dark:bg-slate-950",
          isPanelOpen ? "w-[380px] min-w-[380px]" : "w-0 min-w-0 border-r-0",
        )}
        aria-hidden={!isPanelOpen}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          {plan ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/30">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/shipping/plan/${plan.newId}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                  {plan.planNo}
                </Link>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">{plan.status}</span>
              </div>
              <div className="mt-1 text-slate-600 dark:text-slate-300">
                {plan.originName} → {plan.destinationName}
              </div>
              {planLocked ? <div className="mt-1 text-xs font-medium text-amber-700">Plan {plan.status.toLowerCase()} — tampilan saja, tidak bisa diubah.</div> : null}
            </div>
          ) : null}

          {/* vehicle */}
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kendaraan</h2>
            <Popover open={openVehicle} onOpenChange={setOpenVehicle}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openVehicle}
                  disabled={isLoadingVehicles || vehicles.length === 0 || planLocked}
                  className="h-auto w-full justify-between rounded-xl border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-900"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
                      <Truck className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {isLoadingVehicles ? "Memuat kendaraan..." : selectedVehicleLabel || "Pilih kendaraan"}
                      </span>
                      {selectedVehicleId ? (
                        <span className="block truncate text-xs font-normal text-slate-500">
                          {isLoadingVehicle ? "Memuat..." : `${fmtCm(vehicle.length)} × ${fmtCm(vehicle.width)} × ${fmtCm(vehicle.height)} cm`}
                          {vehicle.maxPayload ? ` · ${vehicle.maxPayload} kg` : ""}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cari kendaraan..." />
                  <CommandList>
                    <CommandEmpty>Kendaraan tidak ditemukan.</CommandEmpty>
                    {vehicles.map((item) => (
                      <CommandItem
                        key={item.value}
                        value={`${item.label} ${item.value}`}
                        onSelect={() => {
                          setSelectedVehicleId(item.value);
                          setOpenVehicle(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedVehicleId === item.value ? "opacity-100" : "opacity-0")} />
                        <span>{item.label}</span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {vehicleError ? <p className="text-xs text-red-500">{vehicleError}</p> : null}
          </section>

          {/* add product */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tambah produk</h2>
              <span className="text-xs text-slate-400">{products.length} produk</span>
            </div>
            <Popover open={openProduct} onOpenChange={setOpenProduct}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openProduct}
                  disabled={isLoadingProducts || products.length === 0 || planLocked}
                  className="w-full justify-between rounded-xl border-slate-200 bg-white shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-900"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-sm font-normal text-slate-600 dark:text-slate-300">
                      {isLoadingProducts ? "Memuat produk..." : "Cari nama atau kode..."}
                    </span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cari produk..." />
                  <CommandList className="max-h-72">
                    <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                    {products.map((item) => (
                      <CommandItem key={item.newId} value={`${item.name} ${item.itemCode}`} className="justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm">{item.name}</div>
                          <div className="truncate text-xs text-slate-500">
                            {item.itemCode} · {item.length}×{item.width}×{item.height} cm · {item.weight} kg
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleAddProduct(item);
                            setOpenProduct(false);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add</span>
                        </Button>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {productError ? <p className="text-xs text-red-500">{productError}</p> : null}
          </section>

          {/* selected items */}
          <section className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Muatan</h2>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{totalUnits} unit</span>
                {selectedItems.length > 0 && !planLocked ? (
                  <button type="button" className="inline-flex items-center gap-1 hover:text-red-500" onClick={() => setSelectedItems([])}>
                    <Trash2 className="h-3 w-3" /> Kosongkan
                  </button>
                ) : null}
              </div>
            </div>

            {selectedItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                Belum ada produk. Tambahkan produk untuk melihat susunannya di truk.
              </div>
            ) : (
              <div className="space-y-2">
                {selectedItems.map((item) => {
                  const spec = specs[item.value];
                  const unplacedOfItem = layout.unplaced.filter((box) => box.productKey === item.id).length;
                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoverItem(item.id)}
                      onMouseLeave={() => setHoverItem(null)}
                      className={cn(
                        "rounded-xl border bg-white p-3 shadow-sm transition-colors dark:bg-slate-900",
                        hoverItem === item.id ? "border-blue-300 dark:border-blue-500/60" : "border-slate-200 dark:border-slate-700",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className={cn("mt-0.5 h-8 w-8 shrink-0 rounded-md shadow-inner", item.color)} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.label}</div>
                          <div className="truncate text-xs text-slate-500">
                            {spec ? (
                              <>
                                {spec.code} · {fmtCm(spec.l)}×{fmtCm(spec.w)}×{fmtCm(spec.h)} cm · {spec.weightKg} kg
                                {!spec.hasDimensions ? " (ukuran default)" : ""}
                              </>
                            ) : (
                              "Memuat ukuran..."
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-300 hover:text-red-500"
                          onClick={() => setSelectedItems((items) => items.filter((it) => it.id !== item.id))}
                          disabled={planLocked}
                          aria-label="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={planLocked} onClick={() => setItemCount(item.id, Math.max(0, parseCount(item.count) - 1))}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <input
                            value={item.count}
                            disabled={planLocked}
                            onChange={(event) => setItemCount(item.id, parseCount(sanitizeCountInput(event.target.value)))}
                            inputMode="numeric"
                            className="h-7 w-14 rounded-md border-0 bg-transparent px-1 text-center text-xs font-bold text-slate-700 outline-none dark:text-slate-100"
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={planLocked} onClick={() => setItemCount(item.id, parseCount(item.count) + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          {spec ? fmtKg(spec.weightKg * parseCount(item.count)) : ""}
                          {unplacedOfItem > 0 ? <div className="font-semibold text-red-500">{unplacedOfItem} tidak muat</div> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          {planId ? (
            <Button className="w-full" onClick={() => void handleSavePlanLoad()} disabled={isSavingPlan || planLocked}>
              {isSavingPlan ? "Menyimpan..." : "Simpan ke Shipping Plan"}
            </Button>
          ) : (
            <Button className="w-full" variant="outline" onClick={handleSaveDraft}>
              Simpan di browser
            </Button>
          )}
        </div>
      </aside>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsPanelOpen((open) => !open)}
        aria-label={isPanelOpen ? "Sembunyikan panel" : "Tampilkan panel"}
        className={cn(
          "absolute top-4 z-20 h-9 w-9 rounded-full border-slate-200 bg-white shadow-md transition-all duration-300 dark:border-slate-700 dark:bg-slate-900",
          isPanelOpen ? "left-[362px]" : "left-3",
        )}
      >
        {isPanelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </Button>

      {/* ---------------- 3D area ---------------- */}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1">
          <Canvas shadows dpr={[1, 2]} camera={{ position: [-8, 5, 9], fov: 36 }} gl={{ antialias: true }} className="h-full w-full">
            <Suspense fallback={null}>
              <TruckScene
                spec={{ length: vehicle.length, width: vehicle.width, height: vehicle.height, type: `${vehicle.type} ${vehicle.name}`, climate: vehicle.climate }}
                boxes={layout.placed}
                zoom={zoom}
                preset={view}
                highlightKey={hoverItem}
              />
            </Suspense>
          </Canvas>

          {/* title + summary */}
          <div className="pointer-events-none absolute left-14 top-4 flex w-[270px] flex-col gap-3">
            <div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/85">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Load Simulation</div>
              <div className="truncate text-xs text-slate-500">
                {vehicle.name || "Pilih kendaraan"}
                {vehicle.type ? ` · ${vehicle.type}` : ""}
                {vehicle.climate ? ` · ${vehicle.climate}` : ""}
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-500">Volume terpakai</span>
                    <span className="text-base font-semibold text-slate-800 dark:text-slate-100">{layout.volumePct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className={cn("h-full rounded-full transition-all duration-500", volumeTone)} style={{ width: `${layout.volumePct}%` }} />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-500">Berat</span>
                    <span className={cn("font-semibold", isOverweight ? "text-red-600" : "text-slate-700 dark:text-slate-200")}>
                      {fmtKg(totalWeightKg)}
                      {vehicle.maxPayload ? ` / ${vehicle.maxPayload} kg` : ""}
                    </span>
                  </div>
                  {vehicle.maxPayload ? (
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", isOverweight ? "bg-red-500" : "bg-sky-500")}
                        style={{ width: `${Math.min((totalWeightKg / vehicle.maxPayload) * 100, 100)}%` }}
                      />
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">Max payload kendaraan belum diisi.</div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{layout.placed.length}</div>
                    <div className="text-slate-500">Termuat</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{layout.floorPct.toFixed(0)}%</div>
                    <div className="text-slate-500">Lantai</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{layout.loadHeight.toFixed(2)} m</div>
                    <div className="text-slate-500">Tinggi</div>
                  </div>
                </div>
              </div>
            </div>

            {notLoaded > 0 ? (
              <div className="pointer-events-auto flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/95 p-3 text-xs text-red-700 shadow">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {notLoaded} unit tidak muat di kendaraan ini ({totalUnits} diminta, {layout.placed.length} termuat). Kurangi jumlah atau pilih kendaraan yang lebih besar.
                </span>
              </div>
            ) : null}
            {isOverweight ? (
              <div className="pointer-events-auto flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/95 p-3 text-xs text-amber-800 shadow">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Berat {fmtKg(totalWeightKg)} melebihi max payload {vehicle.maxPayload} kg
                  {notLoaded > 0 ? ` (termuat ${fmtKg(loadedWeightKg)})` : ""}.
                </span>
              </div>
            ) : null}
            {missingDimensions.length > 0 ? (
              <div className="pointer-events-auto rounded-xl border border-slate-200 bg-white/90 p-3 text-xs text-slate-600 shadow">
                Ukuran {missingDimensions.map((item) => item.label).join(", ")} belum diisi di master Cubstool, dipakai ukuran default 40×30×25 cm.
              </div>
            ) : null}
          </div>

          {/* view + zoom */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3">
            <div className="flex rounded-full border border-white/70 bg-white/90 p-1 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
              {VIEWS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setView(option.key)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                    view === option.key ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-full border border-white/70 bg-white/90 p-1 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="pointer-events-none absolute right-4 top-4 hidden rounded-lg bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-500 backdrop-blur lg:block">
            Klik kiri: putar · Klik kanan: geser · Scroll: zoom
          </div>
        </div>
      </main>
    </div>
  );
}
