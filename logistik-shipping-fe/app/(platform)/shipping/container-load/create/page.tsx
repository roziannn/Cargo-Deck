"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Edges, OrbitControls } from "@react-three/drei";
import { Search, Plus, Box, Trash2, Minus, LayoutPanelTop, ZoomIn, ZoomOut, Check, ChevronsUpDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getStoredAuthToken } from "@/lib/api/auth";
import { listCubstoolLov, type CubstoolLovItem } from "@/lib/api/mst-cubstool";
import { getMstVehicleById, listVehicleLov, type VehicleLovItem } from "@/lib/api/mst-vehicle";
import { cn } from "@/lib/utils";

type VehicleDimensions = {
  length: number;
  width: number;
  height: number;
  floorArea: number;
};

type ProductColorToken = {
  badgeClass: string;
  hex: string;
};

type SelectedProductItem = {
  id: string;
  value: string;
  label: string;
  count: string;
  color: string;
  colorHex: string;
};

type CargoBlock = {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
};

type CargoLayout = {
  blocks: CargoBlock[];
  totalUnits: number;
  visibleUnits: number;
  hiddenUnits: number;
  slotCapacity: number;
  utilizationPct: number;
};

type CameraPreset = "top" | "side" | "rear";

const PRODUCT_COLORS: ProductColorToken[] = [
  { badgeClass: "bg-cyan-400", hex: "#22d3ee" },
  { badgeClass: "bg-lime-500", hex: "#84cc16" },
  { badgeClass: "bg-amber-400", hex: "#fbbf24" },
  { badgeClass: "bg-rose-400", hex: "#fb7185" },
  { badgeClass: "bg-violet-400", hex: "#a78bfa" },
  { badgeClass: "bg-sky-500", hex: "#0ea5e9" },
];

const DEFAULT_VEHICLE_DIMENSIONS: VehicleDimensions = {
  length: 6,
  width: 2.4,
  height: 2.5,
  floorArea: 14.4,
};

const SHIPPING_CONTAINER_LOAD_DRAFT_KEY = "shipping-container-load-create-draft";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseMetricValue(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatMeters(value: number) {
  return `${value.toFixed(2)} m`;
}

function formatDimensionsLabel(dimensions: VehicleDimensions) {
  return `${Math.round(dimensions.length * 100)} x ${Math.round(dimensions.width * 100)} x ${Math.round(dimensions.height * 100)} cm`;
}

function getProductColorToken(value: string) {
  const seed = value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PRODUCT_COLORS[seed % PRODUCT_COLORS.length];
}

function getProductCode(label: string) {
  const parts = label.split(/[-|]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts[parts.length - 1] ?? "";
  }

  return "";
}

function createSelectedItem(product: CubstoolLovItem): SelectedProductItem {
  const colorToken = getProductColorToken(product.value);

  return {
    id: `${product.value}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    value: product.value,
    label: product.label,
    count: "1",
    color: colorToken.badgeClass,
    colorHex: colorToken.hex,
  };
}

function sanitizeCountInput(value: string) {
  const sanitized = value.replace(/[^\d,]/g, "");
  const firstCommaIndex = sanitized.indexOf(",");

  if (firstCommaIndex === -1) return sanitized;

  return `${sanitized.slice(0, firstCommaIndex + 1)}${sanitized.slice(firstCommaIndex + 1).replace(/,/g, "")}`;
}

function parseCount(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCount(value: number) {
  if (Number.isInteger(value)) return String(value);
  return String(value).replace(".", ",");
}

function canFitAdditionalUnits(items: SelectedProductItem[], dimensions: VehicleDimensions, additionalUnits: number) {
  if (additionalUnits <= 0) return true;
  const nextLayout = buildCargoLayout(items, dimensions);
  return nextLayout.totalUnits + additionalUnits <= nextLayout.slotCapacity;
}

function getCapacitySignal(utilizationPct: number) {
  if (utilizationPct > 95) {
    return "red";
  }

  if (utilizationPct > 75) {
    return "yellow";
  }

  return "green";
}

function getVehicleDimensions(detail: {
  dimensionsL?: string;
  dimensionsW?: string;
  floorArea?: string;
  maxHeight?: string;
} | null): VehicleDimensions {
  const length = parseMetricValue(detail?.dimensionsL, DEFAULT_VEHICLE_DIMENSIONS.length);
  const width = parseMetricValue(detail?.dimensionsW, DEFAULT_VEHICLE_DIMENSIONS.width);
  const height = parseMetricValue(detail?.maxHeight, DEFAULT_VEHICLE_DIMENSIONS.height);
  const parsedFloorArea = parseMetricValue(detail?.floorArea, 0);

  return {
    length,
    width,
    height,
    floorArea: parsedFloorArea > 0 ? parsedFloorArea : length * width,
  };
}

function buildCargoLayout(items: SelectedProductItem[], dimensions: VehicleDimensions): CargoLayout {
  // Preferred unit size; the real unit is stretched below so the grid fills the bed exactly (no gaps).
  const preferredLength = clamp(dimensions.length / 7.5, 0.5, 1.05);
  const preferredWidth = clamp(dimensions.width / 3.4, 0.4, 0.8);
  const preferredHeight = clamp(dimensions.height / 3.2, 0.35, 0.9);

  // Inner space of the bed: minus the 0.06 walls on each side and a hair of clearance.
  const WALL_CLEARANCE = 0.07;
  const FLOOR_CLEARANCE = 0.005;
  const usableLength = Math.max(dimensions.length - WALL_CLEARANCE * 2, preferredLength);
  const usableWidth = Math.max(dimensions.width - WALL_CLEARANCE * 2, preferredWidth);
  const usableHeight = Math.max(dimensions.height - 0.1, preferredHeight);

  const columns = Math.max(1, Math.floor(usableLength / preferredLength));
  const rows = Math.max(1, Math.floor(usableWidth / preferredWidth));
  const layers = Math.max(1, Math.floor(usableHeight / preferredHeight));
  const unitLength = usableLength / columns;
  const unitWidth = usableWidth / rows;
  const unitHeight = usableHeight / layers;

  const floorCapacity = columns * rows;
  const slotCapacity = floorCapacity * layers;

  const expandedUnits = items.flatMap((item) => {
    const unitCount = Math.max(0, Math.round(parseCount(item.count)));
    return Array.from({ length: unitCount }, (_, index) => ({
      id: `${item.id}-${index}`,
      color: item.colorHex,
    }));
  });

  const totalUnits = expandedUnits.length;
  const visibleUnits = Math.min(totalUnits, slotCapacity);
  const hiddenUnits = Math.max(0, totalUnits - visibleUnits);
  const blocks: CargoBlock[] = [];

  for (let index = 0; index < visibleUnits; index += 1) {
    // Fill the whole floor (layer 0) before starting layer 1: across the width first, then along the length.
    const layer = Math.floor(index / floorCapacity);
    const onFloor = index % floorCapacity;
    const row = onFloor % rows;
    const column = Math.floor(onFloor / rows);

    const x = -usableLength / 2 + unitLength / 2 + column * unitLength;
    const z = -usableWidth / 2 + unitWidth / 2 + row * unitWidth;
    const y = FLOOR_CLEARANCE + unitHeight / 2 + layer * unitHeight;

    blocks.push({
      id: expandedUnits[index]?.id ?? `block-${index}`,
      position: [x, y, z],
      size: [unitLength, unitHeight, unitWidth],
      color: expandedUnits[index]?.color ?? "#38bdf8",
    });
  }

  return {
    blocks,
    totalUnits,
    visibleUnits,
    hiddenUnits,
    slotCapacity,
    utilizationPct: totalUnits > 0 ? Math.min((visibleUnits / slotCapacity) * 100, 100) : 0,
  };
}

type ShippingContainerLoadDraft = {
  zoom: number;
  selectedContainerType: string;
  selectedItems: SelectedProductItem[];
};

function saveShippingContainerLoadDraft(draft: ShippingContainerLoadDraft) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SHIPPING_CONTAINER_LOAD_DRAFT_KEY, JSON.stringify(draft));
}

function loadShippingContainerLoadDraft(): ShippingContainerLoadDraft | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(SHIPPING_CONTAINER_LOAD_DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ShippingContainerLoadDraft>;
    return {
      zoom: typeof parsed.zoom === "number" ? clamp(parsed.zoom, 0.7, 2) : 1.2,
      selectedContainerType: typeof parsed.selectedContainerType === "string" ? parsed.selectedContainerType : "",
      selectedItems: Array.isArray(parsed.selectedItems)
        ? parsed.selectedItems.filter((item): item is SelectedProductItem => {
            return Boolean(
              item &&
              typeof item.id === "string" &&
              typeof item.value === "string" &&
              typeof item.label === "string" &&
              typeof item.count === "string" &&
              typeof item.color === "string" &&
              typeof item.colorHex === "string",
            );
          })
        : [],
    };
  } catch {
    return null;
  }
}

export default function ShippingPage() {
  const initialDraft = loadShippingContainerLoadDraft();
  const [zoom, setZoom] = useState(initialDraft?.zoom ?? 1.2);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("side");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [containerTypes, setContainerTypes] = useState<VehicleLovItem[]>([]);
  const [selectedContainerType, setSelectedContainerType] = useState(initialDraft?.selectedContainerType ?? "");
  const [isLoadingContainerTypes, setIsLoadingContainerTypes] = useState(true);
  const [containerTypeError, setContainerTypeError] = useState<string | null>(null);
  const [openContainerType, setOpenContainerType] = useState(false);
  const [products, setProducts] = useState<CubstoolLovItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedProductItem[]>(initialDraft?.selectedItems ?? []);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [openProductSelect, setOpenProductSelect] = useState(false);
  const [vehicleDimensions, setVehicleDimensions] = useState<VehicleDimensions>(DEFAULT_VEHICLE_DIMENSIONS);
  const [selectedVehicleName, setSelectedVehicleName] = useState("");
  const [isLoadingVehicleDetail, setIsLoadingVehicleDetail] = useState(false);
  const [vehicleDetailError, setVehicleDetailError] = useState<string | null>(null);

  function handleZoomIn() {
    setZoom((current) => Math.min(current + 0.1, 2));
  }

  function handleZoomOut() {
    setZoom((current) => Math.max(current - 0.1, 0.7));
  }

  useEffect(() => {
    let isMounted = true;

    async function loadContainerTypes() {
      setIsLoadingContainerTypes(true);
      setContainerTypeError(null);

      try {
        const token = getStoredAuthToken() ?? undefined;
        const rows = await listVehicleLov(token);

        if (!isMounted) return;

        setContainerTypes(rows);
        setSelectedContainerType((current) => {
          if (current && rows.some((item) => item.value === current)) return current;
          return rows[0]?.value ?? "";
        });
      } catch (error) {
        if (!isMounted) return;

        setContainerTypes([]);
        setSelectedContainerType("");
        setContainerTypeError(error instanceof Error ? error.message : "Gagal mengambil data container type.");
      } finally {
        if (isMounted) {
          setIsLoadingContainerTypes(false);
        }
      }
    }

    void loadContainerTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setIsLoadingProducts(true);
      setProductError(null);

      try {
        const token = getStoredAuthToken() ?? undefined;
        const rows = await listCubstoolLov(token);

        if (!isMounted) return;

        setProducts(rows);
      } catch (error) {
        if (!isMounted) return;

        setProducts([]);
        setProductError(error instanceof Error ? error.message : "Gagal mengambil data products.");
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadVehicleDetail() {
      if (!selectedContainerType) {
        setVehicleDimensions(DEFAULT_VEHICLE_DIMENSIONS);
        setSelectedVehicleName("");
        setVehicleDetailError(null);
        return;
      }

      setIsLoadingVehicleDetail(true);
      setVehicleDetailError(null);

      try {
        const token = getStoredAuthToken() ?? undefined;
        const detail = await getMstVehicleById(selectedContainerType, token);

        if (!isMounted) return;

        if (!detail) {
          setVehicleDimensions(DEFAULT_VEHICLE_DIMENSIONS);
          setSelectedVehicleName("");
          setVehicleDetailError("Detail vehicle tidak ditemukan.");
          return;
        }

        setVehicleDimensions(getVehicleDimensions(detail));
        setSelectedVehicleName(detail.name || "");
      } catch (error) {
        if (!isMounted) return;

        setVehicleDimensions(DEFAULT_VEHICLE_DIMENSIONS);
        setSelectedVehicleName("");
        setVehicleDetailError(error instanceof Error ? error.message : "Gagal mengambil detail vehicle.");
      } finally {
        if (isMounted) {
          setIsLoadingVehicleDetail(false);
        }
      }
    }

    void loadVehicleDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedContainerType]);

  const selectedContainerTypeLabel = containerTypes.find((item) => item.value === selectedContainerType)?.label ?? "";
  const totalSelectedCount = selectedItems.reduce((sum, item) => sum + parseCount(item.count), 0);
  const cargoLayout = buildCargoLayout(selectedItems, vehicleDimensions);
  const capacitySignal = getCapacitySignal(cargoLayout.utilizationPct);

  function handleSaveData() {
    if (!selectedContainerType) {
      toast.error("Pilih container type terlebih dahulu.");
      return;
    }

    if (selectedItems.length === 0) {
      toast.error("Tambahkan minimal satu product sebelum menyimpan.");
      return;
    }

    saveShippingContainerLoadDraft({
      zoom,
      selectedContainerType,
      selectedItems,
    });
    toast.success("Layout container berhasil disimpan.");
  }

  function handleAddProduct(product: CubstoolLovItem) {
    if (!canFitAdditionalUnits(selectedItems, vehicleDimensions, 1)) {
      toast.error("Kapasitas container sudah 100%. Product tidak bisa ditambahkan lagi.");
      return;
    }

    setSelectedItems((current) => [...current, createSelectedItem(product)]);
  }

  function handleIncreaseProduct(id: string) {
    if (!canFitAdditionalUnits(selectedItems, vehicleDimensions, 1)) {
      toast.error("Kapasitas container sudah 100%. Quantity tidak bisa ditambah lagi.");
      return;
    }

    setSelectedItems((current) =>
      current.map((item) => (item.id === id ? { ...item, count: formatCount(parseCount(item.count) + 1) } : item)),
    );
  }

  function handleDecreaseProduct(id: string) {
    setSelectedItems((current) =>
      current
        .map((item) => (item.id === id ? { ...item, count: formatCount(Math.max(0, parseCount(item.count) - 1)) } : item))
        .filter((item) => parseCount(item.count) > 0),
    );
  }

  function handleRemoveProduct(id: string) {
    setSelectedItems((current) => current.filter((item) => item.id !== id));
  }

  function handleCountChange(id: string, value: string) {
    const sanitized = sanitizeCountInput(value);
    setSelectedItems((current) => {
      const currentItem = current.find((item) => item.id === id);
      if (!currentItem) return current;

      const nextCount = parseCount(sanitized);
      const previousCount = parseCount(currentItem.count);
      const additionalUnits = Math.max(0, nextCount - previousCount);

      if (!canFitAdditionalUnits(current, vehicleDimensions, additionalUnits)) {
        toast.error("Kapasitas container sudah 100%. Quantity tidak bisa ditambah lagi.");
        return current;
      }

      return current.map((item) => (item.id === id ? { ...item, count: sanitized } : item));
    });
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 overflow-hidden">
      <Toaster position="top-center" />
      <aside
        className={cn(
          "flex min-h-0 shrink-0 flex-col gap-8 overflow-hidden border-r border-slate-200 bg-white transition-[width,padding] duration-300 ease-out dark:border-slate-800 dark:bg-slate-950",
          isSidebarOpen ? "w-[400px] min-w-[400px] p-6" : "w-0 min-w-0 border-r-0 px-0 py-6",
        )}
        aria-hidden={!isSidebarOpen}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Container Type</label>
          <Popover open={openContainerType} onOpenChange={setOpenContainerType}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openContainerType}
                disabled={isLoadingContainerTypes || containerTypes.length === 0}
                className="w-full justify-between border-slate-200 bg-white font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Box className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                  <span className="truncate">
                    {isLoadingContainerTypes ? "Loading container type..." : selectedContainerTypeLabel || "Select container type"}
                  </span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search container type..." />
                <CommandList>
                  <CommandEmpty>No container type found.</CommandEmpty>
                  {containerTypes.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={`${item.label} ${item.value}`}
                      onSelect={() => {
                        setSelectedContainerType(item.value);
                        setOpenContainerType(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", selectedContainerType === item.value ? "opacity-100" : "opacity-0")} />
                      <span>{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {containerTypeError ? <p className="text-xs text-red-500 dark:text-red-400">{containerTypeError}</p> : null}
          {vehicleDetailError ? <p className="text-xs text-red-500 dark:text-red-400">{vehicleDetailError}</p> : null}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">Add Products</h2>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{products.length} products</span>
          </div>
          <Popover open={openProductSelect} onOpenChange={setOpenProductSelect}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openProductSelect}
                disabled={isLoadingProducts || products.length === 0}
                className="w-full justify-between rounded-lg border-slate-200 bg-white shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                  <span className="truncate text-sm font-normal text-slate-700 dark:text-slate-300">
                    {isLoadingProducts ? "Loading products..." : "Search by name or code..."}
                  </span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search product..." />
                <CommandList>
                  <CommandEmpty>No product found.</CommandEmpty>
                  {products.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={`${item.label} ${item.value}`}
                      className="justify-between gap-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{item.label}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleAddProduct(item);
                          setOpenProductSelect(false);
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
          {productError ? <p className="text-xs text-red-500 dark:text-red-400">{productError}</p> : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">Selected Items</h2>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">({totalSelectedCount})</span>
          </div>
          <div className="max-h-[336px] space-y-3 overflow-y-auto pr-1">
            {selectedItems.length > 0 ? (
              selectedItems.map((item) => (
                <ItemCard
                  key={item.id}
                  name={item.label}
                  code={getProductCode(item.label)}
                  color={item.color}
                  count={item.count}
                  onCountChange={(value) => handleCountChange(item.id, value)}
                  onDecrease={() => handleDecreaseProduct(item.id)}
                  onIncrease={() => handleIncreaseProduct(item.id)}
                  onRemove={() => handleRemoveProduct(item.id)}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                Belum ada product yang dipilih.
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto">
          <Button variant="default" className="w-full">
            <LayoutPanelTop className="h-4 w-4" />
            <span>Generate Layout</span>
          </Button>
        </div>
      </aside>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsSidebarOpen((current) => !current)}
        aria-label={isSidebarOpen ? "Hide panel" : "Show panel"}
        aria-pressed={isSidebarOpen}
        className={cn(
          "absolute left-0 top-6 z-20 h-10 w-10 rounded-full border-slate-200 bg-white shadow-md transition-all duration-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
          isSidebarOpen ? "translate-x-[380px]" : "translate-x-4",
        )}
      >
        {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </Button>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1rem] font-semibold tracking-tight text-slate-800 dark:text-slate-100 sm:text-[1.15rem]">Truck Container View</h1>
            <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              {isLoadingVehicleDetail ? "Loading dimensions..." : formatDimensionsLabel(vehicleDimensions)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex gap-2 rounded-full bg-slate-800 px-3 py-2 shadow-lg">
              <div
                className={cn(
                  "h-3.5 w-3.5 rounded-full transition-all duration-300",
                  capacitySignal === "red"
                    ? "bg-[#ff3b30] ring-2 ring-red-300/80 shadow-[0_0_14px_rgba(255,110,103,1),0_0_30px_rgba(255,59,48,1),0_0_48px_rgba(185,28,28,1)]"
                    : "bg-[#3b0a0a]",
                )}
              />
              <div
                className={cn(
                  "h-3.5 w-3.5 rounded-full transition-all duration-300",
                  capacitySignal === "yellow"
                    ? "bg-yellow-200 ring-2 ring-yellow-100/60 shadow-[0_0_12px_rgba(254,240,138,1),0_0_28px_rgba(253,224,71,0.95),0_0_42px_rgba(250,204,21,0.78)]"
                    : "bg-yellow-400/30",
                )}
              />
              <div
                className={cn(
                  "h-3.5 w-3.5 rounded-full transition-all duration-300",
                  capacitySignal === "green"
                    ? "bg-green-300 ring-2 ring-green-200/60 shadow-[0_0_12px_rgba(134,239,172,1),0_0_28px_rgba(74,222,128,0.95),0_0_42px_rgba(34,197,94,0.78)]"
                    : "bg-green-500/30",
                )}
              />
            </div>
            <div className="h-9 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
            <div className="text-right">
              <div className="text-[1.1rem] leading-none font-semibold tracking-tight text-blue-600 sm:text-[1.35rem]">{cargoLayout.utilizationPct.toFixed(1)}%</div>
              <div className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-[14px]">Slot Capacity Used</div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.20),_transparent_45%),linear-gradient(180deg,_#f8fbff_0%,_#eef4f8_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.10),_transparent_35%),linear-gradient(180deg,_#0f172a_0%,_#111827_100%)]">
          <div className="relative min-w-0 flex-1 min-h-0">
            <div className="h-full min-h-[560px] w-full overflow-hidden border-y border-slate-200/80 bg-white/40 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/40">
              <Canvas
                shadows
                camera={{ position: [8.2, 4.8, 8.2], fov: 38 }}
                className="h-full w-full"
              >
                <Suspense fallback={null}>
                  <color attach="background" args={["#eef5ff"]} />
                  <fog attach="fog" args={["#eef5ff", 20, 42]} />
                  <ambientLight intensity={1.1} />
                  <directionalLight position={[8, 12, 6]} intensity={1.4} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
                  <directionalLight position={[-4, 6, -8]} intensity={0.45} color="#dbeafe" />
                  <TruckScene dimensions={vehicleDimensions} cargoLayout={cargoLayout} zoom={zoom} cameraPreset={cameraPreset} />
                  <OrbitControls enablePan enableRotate enableZoom minDistance={4} maxDistance={20} maxPolarAngle={Math.PI / 2.08} />
                  <ContactShadows position={[0, -0.12, 0]} opacity={0.22} scale={22} blur={3.4} far={10} color="#94a3b8" />
                </Suspense>
              </Canvas>
            </div>

            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/92 p-2 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/92 sm:left-6">
              <Button
                type="button"
                variant={cameraPreset === "top" ? "default" : "outline"}
                className="h-8 rounded-lg px-3 text-xs font-semibold"
                onClick={() => setCameraPreset("top")}
              >
                Top
              </Button>
              <Button
                type="button"
                variant={cameraPreset === "side" ? "default" : "outline"}
                className="h-8 rounded-lg px-3 text-xs font-semibold"
                onClick={() => setCameraPreset("side")}
              >
                Side
              </Button>
              <Button
                type="button"
                variant={cameraPreset === "rear" ? "default" : "outline"}
                className="h-8 rounded-lg px-3 text-xs font-semibold"
                onClick={() => setCameraPreset("rear")}
              >
                Rear
              </Button>
            </div>

            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 sm:right-6">
              <div className="flex h-11 items-center rounded-xl border border-slate-200/90 bg-white/92 px-1.5 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/92">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <div className="min-w-16 px-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">{Math.round(zoom * 100)}%</div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Button
                variant="outline"
                className="h-11 rounded-xl border-slate-200/90 bg-white/92 px-4 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/92 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={handleSaveData}
              >
                <Box className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>Save Data</span>
              </Button>
            </div>

            <div className="hidden absolute left-6 top-4 z-10 border border-slate-200 bg-white/88 p-4 text-[11px] leading-relaxed text-slate-500 shadow-sm backdrop-blur-sm">
            <p className="mb-1 font-bold text-slate-700">Items: {totalSelectedCount}</p>
            <p>Visible in scene: {cargoLayout.visibleUnits}</p>
            <p>Hidden overflow: {cargoLayout.hiddenUnits}</p>
            <p>
              Truck bed: {formatMeters(vehicleDimensions.length)} x {formatMeters(vehicleDimensions.width)} x {formatMeters(vehicleDimensions.height)}
            </p>
            <ul className="mt-2 space-y-0.5">
              <li>• Left Click: Rotate</li>
              <li>• Right Click: Pan</li>
              <li>• Scroll: Zoom</li>
            </ul>
          </div>
        </div>
      </div>
      </main>
    </div>
  );
}

function TruckScene({
  dimensions,
  cargoLayout,
  zoom,
  cameraPreset,
}: {
  dimensions: VehicleDimensions;
  cargoLayout: CargoLayout;
  zoom: number;
  cameraPreset: CameraPreset;
}) {
  const cabLength = clamp(dimensions.length * 0.26, 1.35, 2.2);
  const wheelRadius = clamp(dimensions.width * 0.16, 0.28, 0.48);
  const wheelThickness = clamp(dimensions.width * 0.16, 0.18, 0.34);
  const bedWallThickness = 0.06;
  const baseY = wheelRadius + 0.18;
  const overallLength = dimensions.length + cabLength + 0.45;

  return (
    <>
      <ResponsiveCamera dimensions={dimensions} zoom={zoom} cameraPreset={cameraPreset} />
      <gridHelper args={[28, 28, "#cbd5e1", "#e2e8f0"]} position={[0, -0.08, 0]} />

      <group position={[0, 0, 0]}>
        <mesh position={[0, wheelRadius + 0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[overallLength, 0.22, dimensions.width * 0.72]} />
          <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.45} />
        </mesh>

        <mesh position={[0.15, baseY + 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[dimensions.length, 0.12, dimensions.width]} />
          <meshStandardMaterial color="#1e293b" metalness={0.25} roughness={0.55} />
        </mesh>

        <mesh position={[0.15, baseY + 0.025 + bedWallThickness / 2, 0]} receiveShadow>
          <boxGeometry args={[dimensions.length, bedWallThickness, dimensions.width]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.08} roughness={0.95} />
        </mesh>

        <mesh position={[0.15, baseY + dimensions.height / 2, dimensions.width / 2 - bedWallThickness / 2]} receiveShadow renderOrder={2}>
          <boxGeometry args={[dimensions.length, dimensions.height, bedWallThickness]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={0.55} depthWrite={false} metalness={0.08} roughness={0.4} />
        </mesh>
        <mesh position={[0.15, baseY + dimensions.height / 2, -dimensions.width / 2 + bedWallThickness / 2]} receiveShadow renderOrder={2}>
          <boxGeometry args={[dimensions.length, dimensions.height, bedWallThickness]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={0.55} depthWrite={false} metalness={0.08} roughness={0.4} />
        </mesh>
        <mesh position={[dimensions.length / 2 - bedWallThickness / 2 + 0.15, baseY + dimensions.height / 2, 0]} receiveShadow renderOrder={2}>
          <boxGeometry args={[bedWallThickness, dimensions.height, dimensions.width]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={0.62} depthWrite={false} metalness={0.08} roughness={0.4} />
        </mesh>
        <mesh position={[-dimensions.length / 2 + bedWallThickness / 2 + 0.15, baseY + dimensions.height / 2, 0]} receiveShadow renderOrder={2}>
          <boxGeometry args={[bedWallThickness, dimensions.height, dimensions.width]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={0.38} depthWrite={false} metalness={0.08} roughness={0.4} />
        </mesh>

        <mesh position={[-dimensions.length / 2 - cabLength / 2 + 0.15, wheelRadius + 0.72, 0]} castShadow receiveShadow>
          <boxGeometry args={[cabLength, 1.45, dimensions.width * 0.88]} />
          <meshStandardMaterial color="#0f766e" metalness={0.25} roughness={0.38} />
        </mesh>
        <mesh position={[-dimensions.length / 2 - cabLength / 2 - 0.14, wheelRadius + 0.65, 0]} castShadow>
          <boxGeometry args={[cabLength * 0.38, 1.05, dimensions.width * 0.78]} />
          <meshStandardMaterial color="#14b8a6" metalness={0.12} roughness={0.36} />
        </mesh>
        <mesh position={[-dimensions.length / 2 - cabLength / 2 + 0.02, wheelRadius + 0.93, 0]} renderOrder={2}>
          <boxGeometry args={[cabLength * 0.5, 0.64, dimensions.width * 0.8]} />
          <meshStandardMaterial color="#bfdbfe" transparent opacity={0.42} depthWrite={false} metalness={0.1} roughness={0.1} />
        </mesh>

        {cargoLayout.blocks.map((block) => (
          <mesh
            key={block.id}
            position={[block.position[0] + 0.15, block.position[1] + baseY + 0.08, block.position[2]]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={block.size} />
            <meshStandardMaterial color={block.color} metalness={0.12} roughness={0.65} />
            <Edges threshold={15} color="#0f172a" />
          </mesh>
        ))}

        {[
          [-dimensions.length / 2 - cabLength * 0.55, wheelRadius, dimensions.width / 2 - wheelThickness / 2],
          [-dimensions.length / 2 - cabLength * 0.55, wheelRadius, -dimensions.width / 2 + wheelThickness / 2],
          [-dimensions.length / 5, wheelRadius, dimensions.width / 2 - wheelThickness / 2],
          [-dimensions.length / 5, wheelRadius, -dimensions.width / 2 + wheelThickness / 2],
          [dimensions.length / 2 - 0.55, wheelRadius, dimensions.width / 2 - wheelThickness / 2],
          [dimensions.length / 2 - 0.55, wheelRadius, -dimensions.width / 2 + wheelThickness / 2],
        ].map((wheelPosition, index) => (
          <group key={`wheel-${index}`} position={wheelPosition as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[wheelRadius, wheelRadius, wheelThickness, 28]} />
              <meshStandardMaterial color="#0f172a" roughness={0.95} />
            </mesh>
            <mesh castShadow>
              <cylinderGeometry args={[wheelRadius * 0.42, wheelRadius * 0.42, wheelThickness + 0.02, 20]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.35} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

function ResponsiveCamera({
  dimensions,
  zoom,
  cameraPreset,
}: {
  dimensions: VehicleDimensions;
  zoom: number;
  cameraPreset: CameraPreset;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const span = Math.max(dimensions.length + 2.2, dimensions.width * 4.2, dimensions.height * 4);
    const distance = clamp(span / zoom, 4.8, 18.5);
    const targetY = dimensions.height * 0.45;

    if (cameraPreset === "top") {
      camera.position.set(0, distance * 1.45, 0.01);
    } else if (cameraPreset === "rear") {
      camera.position.set(distance * 1.08, distance * 0.36, 0);
    } else {
      camera.position.set(0, distance * 0.46, distance * 1.18);
    }

    camera.lookAt(0, targetY, 0);
    camera.updateProjectionMatrix();
  }, [camera, cameraPreset, dimensions.height, dimensions.length, dimensions.width, zoom]);

  return null;
}

function ItemCard({
  name,
  code,
  color,
  count,
  onCountChange,
  onDecrease,
  onIncrease,
  onRemove,
}: {
  name: string;
  code: string;
  color: string;
  count: string;
  onCountChange: (value: string) => void;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500/60">
      <div className={`h-8 w-8 shrink-0 rounded-md ${color} shadow-inner`} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{name}</div>
        {code ? <div className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">{code}</div> : null}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:bg-white hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-blue-400" onClick={onDecrease}>
          <Minus className="h-3 w-3" />
        </Button>
        <input
          value={count}
          onChange={(event) => onCountChange(event.target.value)}
          inputMode="decimal"
          className="h-7 w-10 rounded-md border-0 bg-transparent px-1 text-center text-xs font-bold text-slate-700 outline-none dark:text-slate-100"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:bg-white hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-blue-400" onClick={onIncrease}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <Button variant="ghost" size="icon" className="text-slate-300 transition-colors hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
