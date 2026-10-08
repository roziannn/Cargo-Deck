"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Plus, Search } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { RouteText } from "@/components/route-text";
import { PlanStatusBadge, PriorityBadge } from "@/components/shipping-plan-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import { useI18n } from "@/lib/i18n/provider";
import { formatPlanDate, listShippingPlans, type ShippingPlan, type ShippingPlanStatus } from "@/lib/api/shipping-plan";

const STATUS_FILTERS: ("ALL" | ShippingPlanStatus)[] = ["ALL", "DRAFT", "PLANNED", "APPROVED", "BOOKED", "PICKING", "LOADING", "DISPATCHED", "COMPLETED", "CANCELLED"];

export default function ShippingPlanListPage() {
  return (
    <Suspense fallback={null}>
      <ShippingPlanList />
    </Suspense>
  );
}

function ShippingPlanList() {
  const { t } = useI18n();
  const initialStatus = useSearchParams().get("status");
  const [data, setData] = useState<ShippingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>(STATUS_FILTERS.includes(initialStatus as ShippingPlanStatus) ? (initialStatus as ShippingPlanStatus) : "ALL");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  useEffect(() => {
    listShippingPlans(getStoredAuthToken() ?? undefined)
      .then(setData)
      .catch((error) => toast.error(error instanceof Error ? error.message : t("Gagal mengambil shipping plan.")))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return data.filter(
      (row) =>
        (status === "ALL" || row.status === status) &&
        [row.planNo, row.originName, row.destinationName, row.vehicleName ?? ""].some((v) => v.toLowerCase().includes(keyword)),
    );
  }, [data, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Shipping Plan")}</h1>
        <p className="text-sm text-muted-foreground">{t("Plan shipments, simulate the truck load and get them approved.")}</p>
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
              placeholder={t("Search plan no, origin, destination, vehicle...")}
              className="w-full rounded-md px-9 py-2 text-sm"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as (typeof STATUS_FILTERS)[number]);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? t("All status") : s}
              </option>
            ))}
          </select>
        </div>

        <Button asChild className="font-medium">
          <Link href="/shipping/plan/create">
            <Plus className="mr-2 h-4 w-4" /> {t("New Plan")}
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>{t("Plan No")}</TableHead>
              <TableHead>{t("Route")}</TableHead>
              <TableHead>{t("Ship Date")}</TableHead>
              <TableHead>{t("Delivery Date")}</TableHead>
              <TableHead>{t("Priority")}</TableHead>
              <TableHead>{t("Vehicle")}</TableHead>
              <TableHead className="text-right">{t("Units")}</TableHead>
              <TableHead className="text-right">{t("Weight (kg)")}</TableHead>
              <TableHead className="text-right">{t("Load")}</TableHead>
              <TableHead>{t("Status")}</TableHead>
              <TableHead className="w-20 text-center">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((row) => (
              <TableRow key={row.newId}>
                <TableCell className="font-medium">{row.planNo}</TableCell>
                <TableCell>
                  <RouteText from={row.originName} to={row.destinationName} />
                </TableCell>
                <TableCell>{formatPlanDate(row.plannedShipDate)}</TableCell>
                <TableCell>{formatPlanDate(row.requestedDeliveryDate)}</TableCell>
                <TableCell>
                  <PriorityBadge priority={row.priority} />
                </TableCell>
                <TableCell>{row.vehicleName || "-"}</TableCell>
                <TableCell className="text-right">{row.totalUnits || "-"}</TableCell>
                <TableCell className="text-right">{row.totalUnits ? row.totalWeightKg : "-"}</TableCell>
                <TableCell className="text-right">{row.utilizationPct ? `${row.utilizationPct}%` : "-"}</TableCell>
                <TableCell>
                  <PlanStatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center">
                    <Link href={`/shipping/plan/${row.newId}`} aria-label={t("Open {planNo}", { planNo: row.planNo })}>
                      <Eye className="h-4 w-4 text-muted-foreground hover:text-blue-600" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(isLoading || paginated.length === 0) && (
              <TableRow>
                <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">
                  {isLoading ? t("Loading data...") : t("No shipping plans found")}
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
    </div>
  );
}
