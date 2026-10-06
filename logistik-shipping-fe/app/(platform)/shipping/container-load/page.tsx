"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, NotepadText, Plus, Search, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ShippingPlanRow = {
  id: string;
  date: string;
  destination: string;
  vehicle: string;
};

const SHIPPING_PLAN_ROWS: ShippingPlanRow[] = [
  { id: "SP-001", date: "02 Apr 2026", destination: "DC 1", vehicle: "BM" },
  { id: "SP-002", date: "02 Apr 2026", destination: "DC 3", vehicle: "BUP TK" },
  { id: "SP-003", date: "06 Apr 2026", destination: "DC 1", vehicle: "FUSO AC" },
];

export default function ShippingPlanPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return SHIPPING_PLAN_ROWS;

    return SHIPPING_PLAN_ROWS.filter((item) =>
      [item.date, item.destination, item.vehicle].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Plan Shipping</h1>
        <p className="text-sm text-muted-foreground">Manage shipping plan data.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search tanggal, tujuan, kendaraan..."
            className="w-full rounded-md px-9 py-2 text-sm"
          />
        </div>

        <Button asChild className="font-medium">
          <Link href="/shipping/container-load/create">
            <Plus className="mr-2 h-4 w-4" />
            Add Plan Shipping
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Tujuan</TableHead>
              <TableHead>Kendaraan</TableHead>
              <TableHead className="w-24 text-center">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginated.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.date}</TableCell>
                <TableCell>{row.destination}</TableCell>
                <TableCell>{row.vehicle}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-3">
                    <Button asChild size="icon-sm" variant="ghost">
                      <Link href="/shipping/container-load/create" aria-label={`Edit ${row.id}`}>
                        <SquarePen className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="icon-sm" variant="ghost">
                      <Link href="/shipping/container-load/create" aria-label={`Open ${row.id}`}>
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                    </Button>
                    <Button asChild size="icon-sm" variant="ghost">
                      <Link href={`/shipping/container-load/form?id=${encodeURIComponent(row.id)}`} aria-label={`Open form ${row.id}`}>
                        <NotepadText className="h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
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
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-24 text-center">
              Page {page} of {totalPages}
            </span>

            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
