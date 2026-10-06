"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { ColumnDef, ColumnFiltersState, PaginationState, SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  AlertTriangle, ArrowUpDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Clock3, Container, MapPinned,
  Truck, Waves
} from "lucide-react";

// --- Sub-komponen agar Main Page tetap bersih ---

const shippingStatus = {
  complete: 942,
  failed: 86,
};

const deliveryBreakdown = [
  { label: "On Time", value: 180, percentage: 96.3, colorClass: "bg-emerald-500" },
  { label: "Delayed", value: 7, percentage: 3.7, colorClass: "bg-amber-500" },
] as const;

const failedReasonBreakdown = [
  { label: "Weather Issues", value: 7, percentage: 53.8, colorClass: "bg-rose-500" },
  { label: "Vehicle Issues", value: 4, percentage: 30.8, colorClass: "bg-orange-500" },
  { label: "Miscellaneous", value: 2, percentage: 15.4, colorClass: "bg-slate-500" },
] as const;

type ShippingTask = {
  id: string;
  destination: string;
  items: number;
  containers: string;
  dueDate: string;
  status: "Completed" | "In Progress" | "Pending";
};

const formatLatestUpdate = () =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

const shippingTasksToday: ShippingTask[] = [
  { id: "SHP-2024-001", destination: "Jakarta", items: 45, containers: "Grand Max x 1", dueDate: "10 Mar 2026, 14:00", status: "Completed" },
  { id: "SHP-2024-002", destination: "Surabaya", items: 78, containers: "Fuso x 2", dueDate: "10 Mar 2026, 18:00", status: "In Progress" },
  { id: "SHP-2024-003", destination: "Bandung", items: 32, containers: "Grand Max x 1", dueDate: "10 Mar 2026, 15:00", status: "In Progress" },
  { id: "SHP-2024-004", destination: "Medan", items: 56, containers: "Tronton x 1", dueDate: "11 Mar 2026, 09:00", status: "Pending" },
  { id: "SHP-2024-005", destination: "Batam", items: 28, containers: "CDD Long x 1", dueDate: "11 Mar 2026, 10:30", status: "Pending" },
  { id: "SHP-2024-006", destination: "Makassar", items: 92, containers: "Fuso x 2", dueDate: "11 Mar 2026, 13:00", status: "Pending" },
];

const shippingTasksTomorrow: ShippingTask[] = [
  { id: "SHP-2024-007", destination: "Palembang", items: 34, containers: "CDD Box x 1", dueDate: "12 Mar 2026, 08:30", status: "In Progress" },
  { id: "SHP-2024-008", destination: "Yogyakarta", items: 49, containers: "Grand Max x 1", dueDate: "12 Mar 2026, 10:00", status: "Pending" },
  { id: "SHP-2024-009", destination: "Balikpapan", items: 63, containers: "Fuso x 1", dueDate: "12 Mar 2026, 11:45", status: "Pending" },
  { id: "SHP-2024-010", destination: "Padang", items: 27, containers: "L300 x 1", dueDate: "12 Mar 2026, 14:15", status: "Pending" },
  { id: "SHP-2024-011", destination: "Pontianak", items: 58, containers: "Tronton x 1", dueDate: "12 Mar 2026, 16:00", status: "In Progress" },
] ;

const shippingTasksNext3Days: ShippingTask[] = [
  { id: "SHP-2024-012", destination: "Cirebon", items: 24, containers: "Grand Max x 1", dueDate: "13 Mar 2026, 09:00", status: "Pending" },
  { id: "SHP-2024-013", destination: "Pekanbaru", items: 71, containers: "Fuso x 2", dueDate: "13 Mar 2026, 13:30", status: "In Progress" },
  { id: "SHP-2024-014", destination: "Banjarmasin", items: 44, containers: "CDD Long x 1", dueDate: "14 Mar 2026, 08:45", status: "Pending" },
  { id: "SHP-2024-015", destination: "Manado", items: 65, containers: "Wing Box x 1", dueDate: "14 Mar 2026, 15:00", status: "Pending" },
  { id: "SHP-2024-016", destination: "Jambi", items: 39, containers: "L300 x 1", dueDate: "15 Mar 2026, 10:30", status: "Completed" },
  { id: "SHP-2024-017", destination: "Mataram", items: 55, containers: "Fuso x 1", dueDate: "15 Mar 2026, 17:20", status: "In Progress" },
];

const shippingTasksNext7Days: ShippingTask[] = [
  { id: "SHP-2024-018", destination: "Samarinda", items: 48, containers: "Tronton x 1", dueDate: "16 Mar 2026, 09:40", status: "Pending" },
  { id: "SHP-2024-019", destination: "Banda Aceh", items: 29, containers: "Grand Max x 1", dueDate: "17 Mar 2026, 11:00", status: "Pending" },
  { id: "SHP-2024-020", destination: "Kupang", items: 67, containers: "Fuso x 2", dueDate: "18 Mar 2026, 13:15", status: "In Progress" },
  { id: "SHP-2024-021", destination: "Denpasar", items: 36, containers: "CDD Box x 1", dueDate: "19 Mar 2026, 08:10", status: "Pending" },
  { id: "SHP-2024-022", destination: "Tasikmalaya", items: 31, containers: "L300 x 1", dueDate: "20 Mar 2026, 10:20", status: "Completed" },
  { id: "SHP-2024-023", destination: "Jayapura", items: 82, containers: "Tronton x 1", dueDate: "21 Mar 2026, 14:00", status: "In Progress" },
  { id: "SHP-2024-024", destination: "Sorong", items: 43, containers: "Wing Box x 1", dueDate: "22 Mar 2026, 16:30", status: "Pending" },
];

type ShippingTaskPeriod = {
  key: string;
  label: string;
  data: ShippingTask[];
};

const shippingTaskPeriods: ShippingTaskPeriod[] = [
  { key: "tomorrow", label: "Shipping Tomorrow", data: shippingTasksTomorrow },
  { key: "next3", label: "Shipping Next 3 Days", data: shippingTasksNext3Days },
  { key: "next7", label: "Shipping Next 7 Days", data: shippingTasksNext7Days },
];

type StatCardProps = {
  title: string;
  value: string;
  subtext: string;
  trend: string;
  icon: ComponentType<{ className?: string }>;
};

type ShippingStatusDonutProps = {
  label: string;
  value: number;
  total: number;
  colorClass: string;
};

type StatusBarItemProps = {
  label: string;
  value: number;
  percentage: number;
  colorClass: string;
};

const StatCard = ({ title, value, subtext, icon: Icon, trend }: StatCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground mt-1">
        <span className={trend.includes('+') ? "text-emerald-500" : "text-amber-500"}>
          {trend}
        </span> {subtext}
      </p>
    </CardContent>
  </Card>
);

const ShippingStatusDonut = ({ label, value, total, colorClass }: ShippingStatusDonutProps) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-5">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-border/60"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={colorClass}
          />
        </svg>
        <div className="absolute text-center">
          <p className="text-2xl font-bold leading-none">{Math.round(percentage)}%</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Status</p>
        </div>
      </div>
      <div className="space-y-1 text-center">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">of {total.toLocaleString()} shipments</p>
      </div>
    </div>
  );
};

const StatusBarItem = ({ label, value, percentage, colorClass }: StatusBarItemProps) => (
  <div className="space-y-2">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">
          {value} ({percentage}%)
        </p>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{percentage}%</span>
    </div>
    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${colorClass}`}
        style={{ width: `${percentage}%` }}
        aria-hidden="true"
      />
    </div>
  </div>
);

const taskStatusBadgeVariant: Record<ShippingTask["status"], "default" | "secondary" | "outline"> = {
  Completed: "default",
  "In Progress": "secondary",
  Pending: "outline",
};

const shippingTaskColumns: ColumnDef<ShippingTask>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        ID
        <ArrowUpDown className="h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="text-sm font-semibold text-primary">{row.original.id}</span>,
  },
  {
    accessorKey: "destination",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Destination
        <ArrowUpDown className="h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <MapPinned className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="leading-tight">{row.original.destination}</span>
      </div>
    ),
  },
  {
    accessorKey: "items",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Items
        <ArrowUpDown className="h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.items}</span>,
  },
  {
    accessorKey: "containers",
    header: () => <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Containers</span>,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.containers}</span>,
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Due Date
        <ArrowUpDown className="h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="leading-tight">{row.original.dueDate}</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: () => <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Status</span>,
    cell: ({ row }) => (
      <Badge variant={taskStatusBadgeVariant[row.original.status]}>{row.original.status}</Badge>
    ),
  },
];

type ShippingTasksDataTableProps = {
  title: string;
  data?: ShippingTask[];
  periods?: ShippingTaskPeriod[];
};

function ShippingTasksDataTable({ title, data, periods }: ShippingTasksDataTableProps) {
  const [periodKey, setPeriodKey] = useState<string>(periods?.[0]?.key ?? "");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const activePeriod = periods?.find((item) => item.key === periodKey);
  const activeData = activePeriod ? activePeriod.data : (data ?? []);

  const table = useReactTable({
    data: activeData,
    columns: shippingTaskColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const startRow = filteredCount === 0 ? 0 : pageIndex * table.getState().pagination.pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * table.getState().pagination.pageSize, filteredCount);

  return (
    <Card className="md:col-span-7 overflow-hidden border-border/70 bg-card p-0">
      <CardContent className="space-y-0 p-0">
        <div className="border-b border-border/70 px-4 py-3">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{activePeriod?.label ?? title}</h3>
        </div>

        {periods && periods.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-b border-border/70 px-4 py-3">
            {periods.map((period) => (
              <Button
                key={period.key}
                type="button"
                size="sm"
                variant={period.key === periodKey ? "default" : "outline"}
                className="rounded-full"
                onClick={() => {
                  setPeriodKey(period.key);
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                  setGlobalFilter("");
                }}
              >
                {period.label}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(event) => table.setPageSize(Number(event.target.value))}
              className="h-10 rounded-md border border-border bg-background px-3 text-foreground outline-none"
            >
              {[5, 10, 25].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>entries per page</span>
          </div>
          <div className="flex items-center gap-2 sm:w-[320px]">
            <span className="text-sm text-foreground">Search:</span>
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder=""
              className="h-10 rounded-md border-border bg-background text-foreground shadow-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <Table containerClassName="rounded-none border-0 bg-transparent shadow-none">
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border/70 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-10 px-3">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="h-[52px] border-border/70 bg-background hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={shippingTaskColumns.length} className="h-20 text-center text-muted-foreground">
                  No shipment found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startRow} to {endRow} of {filteredCount} entries
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-md p-0 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-md p-0 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: pageCount }, (_, index) => (
              <Button
                key={index}
                type="button"
                variant={index === pageIndex ? "default" : "ghost"}
                size="sm"
                className={`h-8 min-w-8 rounded-md px-2 font-medium transition-colors ${
                  index === pageIndex
                    ? "font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => table.setPageIndex(index)}
              >
                {index + 1}
              </Button>
            ))}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-md p-0 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-md p-0 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
              onClick={() => table.setPageIndex(Math.max(pageCount - 1, 0))}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LogisticsDashboard() {
  const totalShipments = shippingStatus.complete + shippingStatus.failed;
  const [latestUpdate, setLatestUpdate] = useState<string>(() => formatLatestUpdate());

  useEffect(() => {
    const timer = setInterval(() => {
      setLatestUpdate(formatLatestUpdate());
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Global Shipping Command</h1>
          <p className="text-muted-foreground">Real-time container tracking and yard management system.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-4 py-1">Latest Update: {latestUpdate}</Badge>
          <Badge className="bg-emerald-500 hover:bg-emerald-600">Live</Badge>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Active Shipments" 
          value="1,284" 
          subtext="from last month" 
          trend="+12%" 
          icon={Container} 
        />
        <StatCard 
          title="Fleet Utilization" 
          value="94.2%" 
          subtext="efficiency rate" 
          trend="+2.4%" 
          icon={Truck} 
        />
        <StatCard 
          title="Avg. Transit Time" 
          value="18.5 Days" 
          subtext="sea freight avg." 
          trend="-1.2%" 
          icon={Waves} 
        />
        <StatCard 
          title="System Alerts" 
          value="04" 
          subtext="critical actions" 
          trend="Required" 
          icon={AlertTriangle} 
        />
      </div>

      <div className="grid gap-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Shipping Status Overview</CardTitle>
            <CardDescription>Ringkasan performa shipment dengan status utama dan distribusi kendala pengiriman.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                <ShippingStatusDonut
                  label="Total Complete"
                  value={shippingStatus.complete}
                  total={totalShipments}
                  colorClass="text-emerald-500"
                />
                <ShippingStatusDonut
                  label="Total Failed"
                  value={shippingStatus.failed}
                  total={totalShipments}
                  colorClass="text-rose-500"
                />
              </div>

              <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Shipment Status</p>
                    <p className="mt-1 text-xs text-muted-foreground">Persentase performa pengiriman saat ini.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-emerald-600">
                      {((shippingStatus.complete / totalShipments) * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Success Rate</p>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {deliveryBreakdown.map((item) => (
                    <StatusBarItem key={item.label} {...item} />
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between rounded-2xl border border-dashed border-border/70 bg-background/80 px-4 py-3 text-xs text-muted-foreground">
                  <span>Total shipment processed</span>
                  <span className="font-semibold text-foreground">{totalShipments.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Failed Reasons</p>
                  <p className="mt-1 text-xs text-muted-foreground">Distribusi penyebab shipment gagal.</p>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Distribution</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {failedReasonBreakdown.map((item) => (
                  <StatusBarItem key={item.label} {...item} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <ShippingTasksDataTable title="Shipping Today" data={shippingTasksToday} />
        <ShippingTasksDataTable title="Shipping Planning" periods={shippingTaskPeriods} />
      </div>
    </div>
  );
}
