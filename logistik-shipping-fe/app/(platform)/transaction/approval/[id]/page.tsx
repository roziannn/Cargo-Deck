"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ThumbsUp, UndoIcon, FileText, Clock, Tag, Box, Layers, ChevronLeft } from "lucide-react";
import { getStoredAuthToken, getStoredAuthUser } from "@/lib/api/auth";
import {
  approveValidationForm,
  getValidationFormDetail,
  getValidationFormKeyFromStage,
  returnValidationForm,
  type MstValidationControlSpecItem,
  type ValidationFormKey,
} from "@/lib/api/mst-validation-form";
import { listCoreApprovalHistory, type CoreApprovalTransactionItem } from "@/lib/api/core-approval-transaction";
import { ApiError } from "@/lib/api-client";
import { DateFormat } from "@/utils/date-format";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast, Toaster } from "react-hot-toast";

type ControlRow = {
  key: string;
  processName: string;
  specName: string;
  type: string;
  syarat: string;
  scale: string;
};

function buildControlRows(items: MstValidationControlSpecItem[]): ControlRow[] {
  const groups = new Map<string, MstValidationControlSpecItem[]>();
  for (const item of items) {
    const key = `${item.groupId || `${item.processName}||${item.specName}||${item.type}`}||${item.mstReqCategoryId}`;
    const prev = groups.get(key);
    if (prev) prev.push(item);
    else groups.set(key, [item]);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const sorted = [...group].sort((a, b) => a.sequenceNo - b.sequenceNo);
    const syarat = sorted
      .map((x) => {
        const label = x.fieldLabel || x.fieldCode || "-";
        const value = x.valueNumeric !== null && x.valueNumeric !== undefined ? String(x.valueNumeric) : x.valueText || "-";
        return `${label}: ${value}`;
      })
      .join("  ");

    const scale = sorted.map((x) => x.scale).find((x) => typeof x === "string" && x.trim().length > 0)?.trim() ?? "-";
    return {
      key,
      processName: sorted[0]?.processName ?? "-",
      specName: sorted[0]?.specName ?? "-",
      type: sorted[0]?.type ?? "-",
      syarat: syarat || "-",
      scale,
    };
  });
}

function normalizeStatus(status: string) {
  return (status || "").trim().toLowerCase();
}

function normalizeIdentity(value: string) {
  return (value || "").trim().toLowerCase();
}

function parseApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : fallback;
  }

  const body = error.body as unknown;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const errors = record.errors;
    if (errors && typeof errors === "object") {
      const firstError = Object.values(errors as Record<string, unknown>)
        .flatMap((value) => (Array.isArray(value) ? value : []))
        .find((value) => typeof value === "string" && value.trim().length > 0);
      if (typeof firstError === "string" && firstError.trim()) {
        return `${firstError.trim()} (HTTP ${error.status})`;
      }
    }

    const title = typeof record.title === "string" ? record.title.trim() : "";
    const detail = typeof record.detail === "string" ? record.detail.trim() : "";
    const message = typeof record.message === "string" ? record.message.trim() : "";
    const directMessage = message || title || detail;
    if (directMessage) {
      return `${directMessage} (HTTP ${error.status})`;
    }
  }

  if (error.message?.trim()) {
    return `${error.message.trim()} (HTTP ${error.status})`;
  }

  return fallback;
}

export default function ApprovalPage() {
  const router = useRouter();
  const params = useParams();
  const mstValidationFormId = params.id as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [formDetail, setFormDetail] = React.useState<Awaited<ReturnType<typeof getValidationFormDetail>>>(null);
  const [formKey, setFormKey] = React.useState<ValidationFormKey | null>(null);
  const [approvalRows, setApprovalRows] = React.useState<CoreApprovalTransactionItem[]>([]);
  const [isActing, setIsActing] = React.useState(false);

  const [openApprove, setOpenApprove] = React.useState(false);
  const [openReturn, setOpenReturn] = React.useState(false);
  const [openApprovalHistory, setOpenApprovalHistory] = React.useState(false);
  const [authEmail, setAuthEmail] = React.useState("");
  const [authUsername, setAuthUsername] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [returnNote, setReturnNote] = React.useState("");

  React.useEffect(() => {
    try {
      const user = getStoredAuthUser();
      const email = (user?.email || user?.username || "").trim();
      const username = (user?.username || "").trim();
      if (email) setAuthEmail(email);
      if (username) setAuthUsername(username);
    } catch {}
  }, []);

  const controlRows = React.useMemo(() => buildControlRows(formDetail?.controlSpecs ?? []), [formDetail?.controlSpecs]);
  const mergedControlRows = React.useMemo(() => {
    const out: Array<ControlRow & { showProcess: boolean; processRowSpan: number }> = [];
    for (let i = 0; i < controlRows.length;) {
      const processName = controlRows[i]!.processName;
      let span = 1;
      while (i + span < controlRows.length && controlRows[i + span]!.processName === processName) span += 1;
      for (let j = 0; j < span; j++) {
        const row = controlRows[i + j]!;
        out.push({ ...row, showProcess: j === 0, processRowSpan: j === 0 ? span : 0 });
      }
      i += span;
    }
    return out;
  }, [controlRows]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const [detail, approvals] = await Promise.all([
        getValidationFormDetail(mstValidationFormId, token),
        listCoreApprovalHistory(mstValidationFormId, token),
      ]);
      setFormDetail(detail);
      setFormKey(getValidationFormKeyFromStage(detail?.stage));
      setApprovalRows(approvals);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mengambil data approval.";
      setError(message);
      setFormDetail(null);
      setFormKey(null);
      setApprovalRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [mstValidationFormId]);

  React.useEffect(() => {
    if (mstValidationFormId) void load();
  }, [mstValidationFormId, load]);

  const stageText = formDetail?.stage || "-";
  const currentUser = React.useMemo(() => {
    try {
      return getStoredAuthUser();
    } catch {
      return null;
    }
  }, []);
  const currentUserEmail = React.useMemo(() => normalizeIdentity(currentUser?.email || ""), [currentUser]);
  const hasApprovedByCurrentUser = React.useMemo(() => {
    if (!currentUserEmail) return false;

    return approvalRows.some((row) => {
      const rowStatus = normalizeStatus(row.status);
      const approverUpn = normalizeIdentity(row.userPrincipalName);
      return rowStatus.includes("approve") && approverUpn.length > 0 && approverUpn === currentUserEmail;
    });
  }, [approvalRows, currentUserEmail]);

  return (
    <div className="p-6 min-h-screen space-y-4 bg-zinc-50/50 dark:bg-zinc-900">
      <Toaster position="top-center" />
      <div
        className="
      max-w-5xl mx-auto 
      rounded-xl border
      bg-linear-to-r from-green-50/80 to-emerald-50/60
      dark:from-green-950/40 dark:to-emerald-950/30
      border-green-300/60 dark:border-green-800
      px-6 py-4
      flex items-center justify-between
      shadow-sm
    "
      >
        {/* SHEET NO */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground flex items-center gap-1">
            <FileText className="size-3 text-green-700 dark:text-green-300" />
            SHEET NO
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formDetail?.sheetNo || "-"}</p>
        </div>

        {/* PRODUCT NAME */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground flex items-center gap-1">
            <Box className="size-3 text-green-700 dark:text-green-300" />
            PRODUCT NAME
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formDetail?.productName || "-"}</p>
        </div>

        {/* ITEM CODE */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground flex items-center gap-1">
            <Tag className="size-3 text-green-700 dark:text-green-300" />
            ITEM CODE
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formDetail?.itemCode || "-"}</p>
        </div>

        {/* STAGE */}
        <div className="space-y-1 text-right">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground flex items-center justify-end gap-1">
            <Layers className="size-3 text-green-700 dark:text-green-300" />
            STAGE
          </p>
          <div className="flex flex-col items-end gap-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Stage {stageText}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="max-w-5xl mx-auto rounded-xl">
        <h5 className="px-6 font-semibold m">Parameter/Attribut</h5>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proses</TableHead>
                <TableHead>Parameter / Attribut</TableHead>
                <TableHead>Identification</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Syarat</TableHead>
                <TableHead>Scale</TableHead>
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
              {!isLoading && controlRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    No data
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                mergedControlRows.map((row) => {
                  const isParameter = ["kpp", "cpp", "non_kpp"].includes(normalizeStatus(row.type));
                  return (
                    <TableRow key={row.key}>
                      {row.showProcess && (
                        <TableCell rowSpan={row.processRowSpan} className="align-top">
                          {row.processName}
                        </TableCell>
                      )}
                      <TableCell>{isParameter ? "Parameter" : "Attribut"}</TableCell>
                      <TableCell>{row.specName}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="whitespace-normal">{row.syarat}</TableCell>
                      <TableCell>{row.scale}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!isLoading && !hasApprovedByCurrentUser && (
        <Card className="max-w-5xl mx-auto rounded-xl py-4">
          <CardContent className="flex items-center justify-between">
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  router.push("/transaction/approval");
                }}
                disabled={isActing}
              >
                <ChevronLeft /> Back
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpenApprovalHistory(true)}>
                <Clock className="h-4 w-4" />
                History Approval
              </Button>
            </div>

            <div className="flex gap-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setOpenReturn(true);
                }}
                disabled={isActing}
              >
                <UndoIcon /> Return
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setOpenApprove(true);
                }}
                disabled={isActing}
              >
                <ThumbsUp /> Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(isLoading || hasApprovedByCurrentUser) && (
        <div className="max-w-5xl mx-auto rounded-xl border bg-background px-6 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                router.push("/transaction/approval");
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            <Button variant="outline" className="gap-2" onClick={() => setOpenApprovalHistory(true)}>
              <Clock className="h-4 w-4" />
              History Approval
            </Button>
          </div>
        </div>
      )}

      <Sheet open={openApprovalHistory} onOpenChange={setOpenApprovalHistory}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl px-4 sm:px-6">
          <SheetHeader className="pb-3 pt-2">
            <SheetTitle>Approval History</SheetTitle>
            <SheetDescription>Riwayat approval dan catatan untuk form ini.</SheetDescription>
          </SheetHeader>

          <div className="overflow-auto pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">No</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Employee Cluster</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && approvalRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No approval transactions.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  approvalRows.map((row, index) => (
                    <TableRow key={row.key}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.approverName}</TableCell>
                      <TableCell>{row.approverJobTitle}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell className="whitespace-normal">{row.notes}</TableCell>
                      <TableCell>{row.approvalDate && row.approvalDate !== "-" ? DateFormat(row.approvalDate) : "-"}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={openApprove}
        onOpenChange={(val) => {
          setOpenApprove(val);
          if (!val) {
            setAuthPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="email" />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="password" />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpenApprove(false)} disabled={isActing}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void (async () => {
                  const email = authEmail.trim();
                  const password = authPassword;
                  if (!email || !password) {
                    toast.error("Email dan password wajib diisi.");
                    return;
                  }
                  setIsActing(true);
                  try {
                    const token = getStoredAuthToken() ?? undefined;
                    await approveValidationForm(mstValidationFormId, { email, password }, token, formKey ?? undefined);
                    toast.success("Approved.");
                    setOpenApprove(false);
                    await load();
                  } catch (err) {
                    const message = parseApiErrorMessage(err, "Approve gagal.");
                    toast.error(message);
                  } finally {
                    setIsActing(false);
                  }
                })();
              }}
              disabled={isActing}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openReturn}
        onOpenChange={(val) => {
          setOpenReturn(val);
          if (!val) {
            setAuthPassword("");
            setReturnNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Note</Label>
              <Input value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="Tulis catatan return..." />
            </div>
            <div className="space-y-1">
              <Label>Username</Label>
              <Input value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} placeholder="username" />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="password" />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpenReturn(false)} disabled={isActing}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void (async () => {
                  const username = authUsername.trim();
                  const password = authPassword;
                  const note = returnNote.trim();
                  if (!note) {
                    toast.error("Note wajib diisi.");
                    return;
                  }
                  if (!username || !password) {
                    toast.error("Username dan password wajib diisi.");
                    return;
                  }
                  setIsActing(true);
                  try {
                    const token = getStoredAuthToken() ?? undefined;
                    await returnValidationForm(mstValidationFormId, { username, password, notes: note }, token, formKey ?? undefined);
                    toast.success("Returned.");
                    setOpenReturn(false);
                    window.setTimeout(() => {
                      router.push("/transaction/approval");
                    }, 900);
                  } catch (err) {
                    const message = parseApiErrorMessage(err, "Return gagal.");
                    toast.error(message);
                  } finally {
                    setIsActing(false);
                  }
                })();
              }}
              disabled={isActing}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
