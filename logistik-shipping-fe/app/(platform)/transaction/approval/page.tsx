"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Eye } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { getStoredAuthToken } from "@/lib/api/auth";
import { listCoreApprovalTransactionInbox, type CoreApprovalTransactionInboxItem } from "@/lib/api/core-approval-transaction";
import { DateFormatShort } from "@/utils/date-format";

export default function OnGoingProcessPage() {
  const [data, setData] = useState<CoreApprovalTransactionInboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter((x) => x.productName.toLowerCase().includes(q) || x.createdBy.toLowerCase().includes(q) || x.sheetNo.toLowerCase().includes(q));
  }, [data, search]);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const token = getStoredAuthToken() ?? undefined;
        const rows = await listCoreApprovalTransactionInbox(token);
        if (!active) return;
        setData(rows);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Gagal mengambil data approval.";
        setLoadError(message);
        setData([]);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Transaction Approval
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage transaction approval for manufacturing process control and monitoring.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document Name</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Submitted Date</TableHead>
            <TableHead>Approval Date</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            filtered.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.sheetNo}</TableCell>
                <TableCell className="font-medium">{row.productName}</TableCell>
                <TableCell>{row.createdBy}</TableCell>
                <TableCell>{row.submittedDate && row.submittedDate !== "-" ? DateFormatShort(row.submittedDate) : "-"}</TableCell>
                <TableCell>
                  {row.approvalDate && row.approvalDate !== "-" ? DateFormatShort(row.approvalDate) : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex">
                    <Link href={`/transaction/approval/${row.mstValidationFormId}`}>
                      <Eye className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-blue-600 transition" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}

          {!isLoading && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                No data found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
