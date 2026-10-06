"use client";

import { useEffect, useMemo, useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";

import { Search, ChevronLeft, ChevronRight, CalendarIcon, Download } from "lucide-react";

import { getStoredAuthToken, getStoredAuthUser } from "@/lib/api/auth";
import { listCoreAuditTrail } from "@/lib/api/core-audit-trail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateFormat } from "@/utils/date-format";

import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/utils/utils";

type AuditTrailRow = {
  key: string;
  id: number;
  user: string;
  jobTitle: string;
  activity: string;
  note: string;
  dateTime: string;
};

export default function AuditTrailPage() {
  const [data, setData] = useState<AuditTrailRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ======================
  // Table state
  // ======================
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  // ======================
  // Download dialog state
  // ======================
  const [openDownload, setOpenDownload] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAuditTrail() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const token = getStoredAuthToken() ?? undefined;
        const currentUser = getStoredAuthUser();
        const compcode = currentUser?.site?.trim();

        if (!compcode) {
          throw new Error("Compcode tidak ditemukan. Silakan logout lalu login kembali.");
        }

        const rows = await listCoreAuditTrail(compcode, token);
        setData(rows);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Gagal mengambil data audit trail.";
        setLoadError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadAuditTrail();
  }, []);

  // ======================
  // Filter
  // ======================
  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return data.filter((row) => row.user.toLowerCase().includes(q) || row.activity.toLowerCase().includes(q) || row.note.toLowerCase().includes(q));
  }, [data, search]);

  // ======================
  // Pagination
  // ======================
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);
  const totalEntries = filtered.length;
  const fromEntry = totalEntries === 0 ? 0 : Math.min(startIndex + 1, totalEntries);
  const toEntry = totalEntries === 0 ? 0 : Math.min(startIndex + rowsPerPage, totalEntries);

  // ======================
  // Download handler
  // ======================
  function handleDownload() {
    if (!startDate || !endDate) {
      setDownloadError("Please select start date and end date");
      return;
    }

    const diff = differenceInCalendarDays(endDate, startDate);

    if (diff < 0) {
      setDownloadError("End date must be after start date");
      return;
    }

    if (diff > 30) {
      setDownloadError("Maximum range is 30 days");
      return;
    }

    setDownloadError(null);

    const from = format(startDate, "yyyy-MM-dd");
    const to = format(endDate, "yyyy-MM-dd");

    // trigger download
    window.location.href = `/api/audit-trail/download?from=${from}&to=${to}`;

    // ======================
    // 👉 auto close & reset
    // ======================
    setOpenDownload(false);
    setStartDate(undefined);
    setEndDate(undefined);
    setDownloadError(null);
  }

  return (
    <div className="p-6 space-y-6 min-h-screen">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Audit Trail
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage audit trail for manufacturing process control and monitoring.
        </p>
      </div>
      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}
      {/* ================= Header ================= */}
      <div className="flex items-center justify-between">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search audit trail..."
            className="w-full rounded-md px-9"
          />
        </div>

        {/* Download dialog */}
        <Dialog open={openDownload} onOpenChange={setOpenDownload}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Download Audit Trail Report</DialogTitle>
              <DialogDescription>Select a date range to download the audit trail report. Maximum range is 30 days.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Start date */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Start Date</label>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Select start date"}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => {
                        setStartDate(d);
                        setDownloadError(null);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End date */}
              <div className="space-y-1">
                <label className="text-sm font-medium">End Date</label>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => {
                        setEndDate(d);
                        setDownloadError(null);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {downloadError && <p className="text-sm text-destructive">{downloadError}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenDownload(false)}>
                Cancel
              </Button>

              <Button onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="w-[220px]">Job Title</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Date Time</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginated.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.user}</TableCell>
                <TableCell className="w-[220px] whitespace-normal break-words">{row.jobTitle}</TableCell>
                <TableCell>{row.activity}</TableCell>
                <TableCell className="whitespace-normal">{row.note}</TableCell>
                <TableCell>{row.dateTime ? DateFormat(row.dateTime) : "-"}</TableCell>
              </TableRow>
            ))}

            {!isLoading && paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  No data found
                </TableCell>
              </TableRow>
            )}
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Loading data...
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
    </div>
  );
}
