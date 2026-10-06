"use client";

import { useRouter, useParams } from "next/navigation";
import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LockKeyhole, Save, Send, XCircle } from "lucide-react";

export default function OngoingProcessPage() {
  const router = useRouter();
  const params = useParams();

  const id = params.id as string;

  // dummy batch list (nanti ganti dari API)
  const batchList = useMemo(() => ["KGBTB6181", "KGBTB6182", "KGBTB6183", "KGBTB6184"], []);

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-900 py-8">
      <div
        className="
        max-w-5xl mx-auto mb-6
        rounded-xl border
        bg-linear-to-r from-emerald-50 to-green-50
        dark:from-emerald-950/40 dark:to-green-950/30
        border-emerald-200 dark:border-emerald-800
        px-6 py-4
        flex items-center justify-between
        shadow-sm
      "
      >
        <div className="text-sm space-y-1">
          <p>
            <span className="font-semibold">Product Name</span> : GABAPENTIN 300MG KAPSUL
          </p>
          <p>
            <span className="font-semibold">Item Code</span> : KGBTB
          </p>
        </div>

        <div className="text-sm text-right space-y-1">
          <p>
            <span className="font-semibold">Batch No.</span> : KGBTB6181
          </p>
          <p>
            <span className="font-semibold">Status</span> : Process Validation Stage 2
          </p>
        </div>
      </div>

      {/* ===== MAIN CARD ===== */}
      <Card className="max-w-5xl mx-auto rounded-xl border shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-12 gap-6">
            {/* ===== SIDEBAR ===== */}
            <aside className="col-span-2 rounded-lg border bg-background p-4 h-fit">
              <Label className="text-xs font-semibold">Batch No.</Label>
              <Input className="mt-1 mb-3 h-8 text-sm" placeholder="Search..." />

              <div className="space-y-1 text-sm">
                {batchList.map((b) => {
                  const active = b === id;

                  return (
                    <div
                      key={b}
                      onClick={() => router.push(`/validation/ongoing-process/${b}`)}
                      className={`px-3 py-2 rounded-md cursor-pointer transition
                        ${active ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted"}
                      `}
                    >
                      {b}
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* ===== CONTENT ===== */}
            <main className="col-span-10 space-y-4">
              <Accordion type="multiple" defaultValue={["pengayakan"]} className="space-y-3">
                {/* ===== PENGAYAKAN ===== */}
                <AccordionItem value="pengayakan" className="border rounded-lg">
                  <AccordionTrigger className="px-4 py-3 text-sm font-semibold">Pengayakan Sodium Starch Glycolate</AccordionTrigger>

                  <AccordionContent className="px-4 pb-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parameter</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Requirement</TableHead>
                          <TableHead>Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          ["Kondisi Ayakan Sebelum Proses", "Baik"],
                          ["Ukuran Mesh", "Mesh 30"],
                          ["Kondisi Ayakan Setelah Proses", "Baik"],
                        ].map(([param, req], i) => (
                          <TableRow key={i}>
                            <TableCell className="whitespace-normal">{param}</TableCell>
                            <TableCell>CPP</TableCell>
                            <TableCell className="whitespace-normal">{req}</TableCell>
                            <TableCell className="min-w-52">
                              <Input className="h-8 text-sm bg-background" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>

                {/* ===== FILLING ===== */}
                <AccordionItem value="filling" className="border rounded-lg">
                  <AccordionTrigger className="px-4 py-3 text-sm font-semibold">Filling</AccordionTrigger>

                  <AccordionContent className="px-4 pb-4 space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Attribut</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Requirement</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium text-red-600">Kadar</TableCell>
                          <TableCell>CQA</TableCell>
                          <TableCell className="whitespace-normal">LSL (90), USL (110)</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    <div className="rounded-lg border border-dashed p-4 bg-indigo-50/40 dark:bg-indigo-950/20">
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        {["Average (per batch)", "Average (overall)", "Moving Range", "Avg Moving Range", "D2 (w=2)", "Within Std Dev (σ)"].map((t) => (
                          <div key={t}>
                            <Label className="text-xs mb-2">{t}</Label>
                            <Input className="h-8 text-xs bg-background" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-dashed p-4 bg-indigo-50/40 dark:bg-indigo-950/20">
                      <Label className="text-xs font-semibold">New Control Limit</Label>
                      <div className="grid grid-cols-5 gap-3 mt-2 text-xs">
                        {["LCL", "UCL", "CpL", "CpU", "Cpk"].map((t) => (
                          <div key={t}>
                            <Label className="text-xs mb-2">{t}</Label>
                            <Input className="h-8 text-xs bg-background" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* ===== DISOLUSI ===== */}
                <AccordionItem value="disolusi" className="border rounded-lg">
                  <AccordionTrigger className="px-4 py-3 text-sm font-semibold">Disolusi</AccordionTrigger>

                  <AccordionContent className="px-4 pb-4 space-y-4">
                    <p className="text-sm font-medium">
                      LLC : <span className="text-red-500 font-bold">85%</span>
                    </p>

                    {[1, 2, 3].map((r) => (
                      <div key={r} className="rounded-lg border bg-sky-50/60 dark:bg-sky-950/30 p-4 space-y-3">
                        <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">Replikasi {r}</p>

                        {[0, 12].map((start) => (
                          <div key={start} className="grid grid-cols-12 gap-2">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div key={i + start} className="text-center text-xs">
                                <Label>{i + 1 + start}</Label>
                                <Input className="h-8 text-xs bg-background" />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </main>
          </div>
        </CardContent>
      </Card>

      {/* ===== FOOTER ACTION ===== */}
      <Card className="max-w-5xl mx-auto mt-6 rounded-xl border shadow-sm">
        <CardContent className="flex items-center justify-between">
          <Button variant="destructive" size="sm">
            <XCircle className="mr-2 h-4 w-4" />
            Cancel
          </Button>

          <div className="flex gap-3">
            <Button variant="outline" size="sm">
              <Save className="mr-1 h-4 w-4" />
              Save as Draft
            </Button>
            <Button variant="default" size="sm">
              <Send className="mr-1 h-4 w-4" />
              Submit
            </Button>
            <Button variant="outline" size="sm">
              <LockKeyhole className="mr-1 h-4 w-4" />
              Lock
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
