"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Plus, Search } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { IncidentStatusBadge } from "@/components/shipping-incident-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import {
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
  isIncidentOpen,
  listShippingIncidents,
  type IncidentStatus,
  type ShippingIncident,
} from "@/lib/api/shipping-incident";
import { formatPlanDate, formatRupiah } from "@/lib/api/shipping-plan";
import { cn } from "@/lib/utils";

const FILTERS: ("ALL" | "ACTIVE" | IncidentStatus)[] = [
  "ACTIVE",
  "ALL",
  "OPEN",
  "IN_PROGRESS",
  "CLAIM_FILED",
  "RESOLVED",
  "REJECTED",
];
const today = () => new Date().toISOString().slice(0, 10);

export default function ShippingIncidentListPage() {
  const [data, setData] = useState<ShippingIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ACTIVE");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  useEffect(() => {
    listShippingIncidents(getStoredAuthToken() ?? undefined)
      .then(setData)
      .catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengambil data insiden.",
        ),
      )
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return data.filter(
      (row) =>
        (filter === "ALL" ||
          (filter === "ACTIVE"
            ? isIncidentOpen(row.status)
            : row.status === filter)) &&
        [
          row.incidentNo,
          row.planNo,
          row.description,
          row.carrierName ?? "",
          INCIDENT_TYPE_LABEL[row.type],
        ].some((v) => v.toLowerCase().includes(keyword)),
    );
  }, [data, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Insiden &amp; Klaim
        </h1>
        <p className="text-sm text-muted-foreground">
          Masalah selama pengiriman: terlambat, barang rusak atau kurang, suhu,
          retur. Klik insiden untuk menanganinya.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari no insiden, plan, carrier, kejadian..."
              className="w-full rounded-md px-9 py-2 text-sm"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as (typeof FILTERS)[number]);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {f === "ALL"
                  ? "Semua status"
                  : f === "ACTIVE"
                    ? "Belum selesai"
                    : INCIDENT_STATUS_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
        <Button asChild className="font-medium">
          <Link href="/shipping/incident/create">
            <Plus className="mr-2 h-4 w-4" /> Lapor Insiden
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>No Insiden</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Kejadian</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Estimasi Selesai</TableHead>
              <TableHead className="text-right">Klaim</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((row) => {
              const overdue =
                isIncidentOpen(row.status) &&
                row.targetDate !== null &&
                row.targetDate < today();
              return (
                <TableRow key={row.newId}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/shipping/incident/${row.newId}`}
                      className="hover:underline"
                    >
                      {row.incidentNo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/shipping/plan/${row.planNewId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {row.planNo}
                    </Link>
                  </TableCell>
                  <TableCell>{INCIDENT_TYPE_LABEL[row.type]}</TableCell>
                  <TableCell
                    className="max-w-64 truncate"
                    title={row.description}
                  >
                    {row.description}
                  </TableCell>
                  <TableCell>{formatPlanDate(row.occurredDate)}</TableCell>
                  <TableCell
                    className={cn(overdue && "font-medium text-red-600")}
                  >
                    {formatPlanDate(row.targetDate)}
                    {overdue && " (lewat)"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.claimAmount ? formatRupiah(row.claimAmount) : "-"}
                  </TableCell>
                  <TableCell>
                    <IncidentStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Link
                        href={`/shipping/incident/${row.newId}`}
                        aria-label={`Tangani ${row.incidentNo}`}
                      >
                        <Eye className="h-4 w-4 text-muted-foreground hover:text-blue-600" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {(isLoading || paginated.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-6 text-center text-muted-foreground"
                >
                  {isLoading ? "Loading data..." : "Tidak ada insiden"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-2 border-t px-3 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {Math.min(startIndex + 1, filtered.length || 0)} to{" "}
            {Math.min(startIndex + rowsPerPage, filtered.length)} of{" "}
            {filtered.length} entries
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-center">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
