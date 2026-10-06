"use client";

import { format, parse } from "date-fns";
import jsPDF from "jspdf";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CalendarIcon, Clock3, Printer, Save } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/utils/utils";

type ShippingHeaderForm = {
  tanggal: string;
  namaDriver: string;
  noPolisi: string;
  ekspedisi: string;
  distCustomer: string;
  jenisKendaraan: string;
  noIdLogger: string;
  tanggalRekalibrasi: string;
  suhuAwal: string;
  suhuSetelah: string;
  jamAwal: string;
  jamSetelah: string;
  alurPengiriman: string;
};

type HeaderFieldKey = Exclude<keyof ShippingHeaderForm, "alurPengiriman">;

const EMPTY_SHIPPING_HEADER_FORM: ShippingHeaderForm = {
  tanggal: "",
  namaDriver: "",
  noPolisi: "",
  ekspedisi: "",
  distCustomer: "",
  jenisKendaraan: "",
  noIdLogger: "",
  tanggalRekalibrasi: "",
  suhuAwal: "",
  suhuSetelah: "",
  jamAwal: "",
  jamSetelah: "",
  alurPengiriman: "PENERIMAAN / PENGIRIMAN",
};

const SHIPPING_HEADER_PRESETS: Record<string, ShippingHeaderForm> = {
  "SP-001": {
    tanggal: "02 Apr 2026",
    namaDriver: "Budi Santoso",
    noPolisi: "B 9123 TKA",
    ekspedisi: " Logistics",
    distCustomer: "DC 1",
    jenisKendaraan: "BM",
    noIdLogger: "LG-2026-001",
    tanggalRekalibrasi: "15 Mar 2026",
    suhuAwal: "4",
    suhuSetelah: "5",
    jamAwal: "08.15",
    jamSetelah: "10.10",
    alurPengiriman: "PENERIMAAN / PENGIRIMAN",
  },
  "SP-002": {
    tanggal: "02 Apr 2026",
    namaDriver: "Hendra Wijaya",
    noPolisi: "B 8741 QXP",
    ekspedisi: "Prima Expedition",
    distCustomer: "DC 3",
    jenisKendaraan: "BUP TK",
    noIdLogger: "LG-2026-002",
    tanggalRekalibrasi: "18 Mar 2026",
    suhuAwal: "3",
    suhuSetelah: "4",
    jamAwal: "09.00",
    jamSetelah: "11.25",
    alurPengiriman: "PENERIMAAN / PENGIRIMAN",
  },
  "SP-003": {
    tanggal: "06 Apr 2026",
    namaDriver: "Rizky Pratama",
    noPolisi: "B 8017 ACF",
    ekspedisi: "Sentosa Transport",
    distCustomer: "DC 1",
    jenisKendaraan: "FUSO AC",
    noIdLogger: "LG-2026-003",
    tanggalRekalibrasi: "20 Mar 2026",
    suhuAwal: "2",
    suhuSetelah: "3",
    jamAwal: "07.45",
    jamSetelah: "09.20",
    alurPengiriman: "PENERIMAAN / PENGIRIMAN",
  },
};

const HEADER_ROW_PAIRS: Array<{
  left: { label: string; field: HeaderFieldKey; suffix?: string; required?: boolean };
  right: { label: string; field: HeaderFieldKey; suffix?: string; required?: boolean };
}> = [
  {
    left: { label: "Tanggal", field: "tanggal" },
    right: { label: "No / ID Logger", field: "noIdLogger" },
  },
  {
    left: { label: "Nama Driver", field: "namaDriver" },
    right: { label: "Tanggal Rekalibrasi", field: "tanggalRekalibrasi" },
  },
  {
    left: { label: "No Polisi", field: "noPolisi" },
    right: { label: "Suhu Awal Muat/Bongkar", field: "suhuAwal", suffix: "deg C", required: true },
  },
  {
    left: { label: "Ekspedisi", field: "ekspedisi" },
    right: { label: "Suhu Setelah Muat/Bongkar", field: "suhuSetelah", suffix: "deg C", required: true },
  },
  {
    left: { label: "Dist/Customer", field: "distCustomer" },
    right: { label: "Jam Awal Muat/Bongkar", field: "jamAwal", required: true },
  },
  {
    left: { label: "Jenis Kendaraan", field: "jenisKendaraan" },
    right: { label: "Jam Setelah Muat/Bongkar", field: "jamSetelah", required: true },
  },
];

const PRODUCT_CHECK_ROWS = Array.from({ length: 12 }, (_, index) => index);

function getShippingHeaderForm(planId: string) {
  return SHIPPING_HEADER_PRESETS[planId] ?? EMPTY_SHIPPING_HEADER_FORM;
}

function parseDisplayDate(value: string) {
  if (!value) return undefined;

  const parsedDate = parse(value, "dd MMM yyyy", new Date());
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function parseDisplayTime(value: string) {
  if (!value) return "";
  return value.replace(".", ":");
}

function getTimeParts(value: string) {
  const normalized = parseDisplayTime(value);
  const [hour = "00", minute = "00"] = normalized.split(":");

  return {
    hour: hour.padStart(2, "0"),
    minute: minute.padStart(2, "0"),
  };
}

function buildDisplayTime(hour: string, minute: string) {
  return `${hour}.${minute}`;
}

async function loadImageAsDataUrl(source: string) {
  try {
    const response = await fetch(source);
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Failed to read logo image"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function drawPdfCell(pdf: jsPDF, x: number, y: number, width: number, height: number, text = "", options?: {
  align?: "left" | "center" | "right";
  bold?: boolean;
  fontSize?: number;
  paddingX?: number;
  paddingY?: number;
  valign?: "top" | "middle";
}) {
  const {
    align = "left",
    bold = false,
    fontSize = 8,
    paddingX = 2,
    paddingY = 2,
    valign = "middle",
  } = options ?? {};

  pdf.rect(x, y, width, height);
  pdf.setFont("helvetica", bold ? "bold" : "normal");
  pdf.setFontSize(fontSize);

  if (!text) {
    return;
  }

  const lines = pdf.splitTextToSize(text, Math.max(width - paddingX * 2, 1));
  const lineHeight = fontSize * 0.35 + 1.2;
  const textHeight = lines.length * lineHeight;
  const textY = valign === "top"
    ? y + paddingY + lineHeight * 0.8
    : y + Math.max((height - textHeight) / 2, paddingY) + lineHeight * 0.8;
  const textX = align === "center"
    ? x + width / 2
    : align === "right"
      ? x + width - paddingX
      : x + paddingX;

  pdf.text(lines, textX, textY, { align, baseline: "alphabetic" });
}

function drawEmptyCheckbox(pdf: jsPDF, centerX: number, centerY: number, size = 3.2) {
  pdf.rect(centerX - size / 2, centerY - size / 2, size, size);
}

function drawPdfLineField(
  pdf: jsPDF,
  x: number,
  y: number,
  label: string,
  lineWidth: number,
  options?: {
    unit?: string;
    labelWidth?: number;
    fontSize?: number;
  },
) {
  const {
    unit,
    labelWidth = 48,
    fontSize = 6.5,
  } = options ?? {};

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fontSize);
  pdf.text(label, x, y);
  pdf.text(":", x + labelWidth, y);

  const lineStartX = x + labelWidth + 3;
  const unitWidth = unit ? 6 : 0;
  const lineEndX = lineStartX + Math.max(lineWidth - unitWidth, 10);

  pdf.setLineWidth(0.2);
  pdf.line(lineStartX, y + 0.8, lineEndX, y + 0.8);

  if (unit) {
    pdf.setFont("helvetica", "bold");
    pdf.text(unit, lineEndX + 2, y);
  }
}

function renderShippingHeaderPdf(pdf: jsPDF, form: ShippingHeaderForm, logoDataUrl: string) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const left = 10;
  const top = 10;
  const totalWidth = pageWidth - left * 2;
  const logoWidth = 24;
  const titleHeight = 20;
  pdf.rect(left, top, totalWidth, titleHeight);

  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, "PNG", left + 3, top + 3, logoWidth - 6, titleHeight - 6);
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("LOGO", left + logoWidth / 2, top + titleHeight / 2 + 1, { align: "center" });
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("FORMULIR PENERIMAAN / PENGIRIMAN OBAT JADI", left + totalWidth / 2, top + titleHeight / 2 + 1, { align: "center" });

  const startY = top + titleHeight;
  const rowHeight = 8;
  const columnWidth = totalWidth / 2;
  const labelWidth = 42;
  const colonWidth = 4;
  const valueWidth = columnWidth - labelWidth - colonWidth;

  HEADER_ROW_PAIRS.forEach((row, index) => {
    const y = startY + index * rowHeight;
    const leftX = left;
    const rightX = left + columnWidth;

    drawPdfCell(pdf, leftX, y, labelWidth, rowHeight, row.left.label, { bold: true, fontSize: 7.5 });
    drawPdfCell(pdf, leftX + labelWidth, y, colonWidth, rowHeight, ":", { align: "center", bold: true, fontSize: 8 });
    drawPdfCell(pdf, leftX + labelWidth + colonWidth, y, valueWidth, rowHeight, `${form[row.left.field]}${row.left.suffix ? ` ${row.left.suffix}` : ""}`, { fontSize: 7.5 });

    drawPdfCell(pdf, rightX, y, labelWidth, rowHeight, row.right.label, { bold: true, fontSize: 7.5 });
    drawPdfCell(pdf, rightX + labelWidth, y, colonWidth, rowHeight, ":", { align: "center", bold: true, fontSize: 8 });
    drawPdfCell(pdf, rightX + labelWidth + colonWidth, y, valueWidth, rowHeight, `${form[row.right.field]}${row.right.suffix ? ` ${row.right.suffix}` : ""}`, { fontSize: 7.5 });
  });

  const flowY = startY + HEADER_ROW_PAIRS.length * rowHeight;
  drawPdfCell(pdf, left, flowY, totalWidth, 10, `${form.alurPengiriman || "PENERIMAAN / PENGIRIMAN"} *`, {
    align: "center",
    bold: true,
    fontSize: 11,
  });

  return flowY + 10;
}

function renderProductTablePdf(pdf: jsPDF, startY: number) {
  const left = 10;
  const widths = [24, 40, 18, 18, 18, 18, 22, 32];
  const x = widths.reduce<number[]>((acc, width, index) => {
    if (index === 0) return [left];
    acc.push(acc[index - 1] + widths[index - 1]);
    return acc;
  }, []);

  const topHeaderHeight = 7;
  const subHeaderHeight = 6.5;
  const rowHeight = 6.5;

  drawPdfCell(pdf, x[0], startY, widths[0], topHeaderHeight + subHeaderHeight, "Batch Number", { align: "center", bold: true, fontSize: 7 });
  drawPdfCell(pdf, x[1], startY, widths[1], topHeaderHeight + subHeaderHeight, "Quantity MB (C atau c)", { align: "center", bold: true, fontSize: 7 });
  drawPdfCell(pdf, x[2], startY, widths[2] + widths[3] + widths[4] + widths[5], topHeaderHeight, "Pengecekan Kondisi Produk", { align: "center", bold: true, fontSize: 7 });
  drawPdfCell(pdf, x[6], startY, widths[6], topHeaderHeight, "Qty Full MB", { align: "center", bold: true, fontSize: 7 });
  drawPdfCell(pdf, x[7], startY, widths[7], topHeaderHeight, "Quantity Pick", { align: "center", bold: true, fontSize: 7 });

  drawPdfCell(pdf, x[2], startY + topHeaderHeight, widths[2], subHeaderHeight, "Posisi MB", { align: "center", bold: true, fontSize: 5.4, paddingX: 0.8 });
  drawPdfCell(pdf, x[3], startY + topHeaderHeight, widths[3], subHeaderHeight, "Tumpukan MB", { align: "center", bold: true, fontSize: 5.1, paddingX: 0.6 });
  drawPdfCell(pdf, x[4], startY + topHeaderHeight, widths[4], subHeaderHeight, "Fisik Produk", { align: "center", bold: true, fontSize: 5.1, paddingX: 0.6 });
  drawPdfCell(pdf, x[5], startY + topHeaderHeight, widths[5], subHeaderHeight, "Label", { align: "center", bold: true, fontSize: 5.4, paddingX: 0.8 });
  drawPdfCell(pdf, x[6], startY + topHeaderHeight, widths[6], subHeaderHeight, "(Box/Botol/Vial)", { align: "center", fontSize: 5.5 });
  drawPdfCell(pdf, x[7], startY + topHeaderHeight, widths[7], subHeaderHeight, "(Box/Botol/Vial)", { align: "center", fontSize: 5.5 });

  PRODUCT_CHECK_ROWS.forEach((rowIndex) => {
    const y = startY + topHeaderHeight + subHeaderHeight + rowIndex * rowHeight;

    widths.forEach((width, index) => {
      drawPdfCell(pdf, x[index], y, width, rowHeight);
    });

    drawEmptyCheckbox(pdf, x[2] + widths[2] / 2, y + rowHeight / 2, 2.6);
    drawEmptyCheckbox(pdf, x[3] + widths[3] / 2, y + rowHeight / 2, 2.6);
    drawEmptyCheckbox(pdf, x[4] + widths[4] / 2, y + rowHeight / 2, 2.6);
    drawEmptyCheckbox(pdf, x[5] + widths[5] / 2, y + rowHeight / 2, 2.6);
  });

  return startY + topHeaderHeight + subHeaderHeight + PRODUCT_CHECK_ROWS.length * rowHeight;
}

function renderNotesAndSignaturePdf(pdf: jsPDF, startY: number) {
  const left = 10;
  const totalWidth = 190;
  let y = startY;

  const cardHeight = 43;
  pdf.rect(left, y, totalWidth, cardHeight);
  pdf.line(left, y + 6, left + totalWidth, y + 6);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Catatan", left + 2, y + 4.2);
  y += 8;

  const noteText =
    "Catat pada kolom ini jika terdapat produk kondisi ketidaksesuaian dalam bentuk apa pun atau terjadi penyimpangan.";
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text(pdf.splitTextToSize(noteText, totalWidth - 4), left + 2, y + 1.5);
  y += 13;

  drawPdfLineField(pdf, left + 2, y + 4, "Nomor seal/segel", 76, { labelWidth: 46, fontSize: 6.5 });
  drawPdfLineField(pdf, left + 2, y + 11, "Suhu min. saat penerimaan", 76, { unit: "C", labelWidth: 46, fontSize: 6.5 });
  drawPdfLineField(pdf, left + 2, y + 17, "Suhu max. saat penerimaan", 76, { unit: "C", labelWidth: 46, fontSize: 6.5 });
  y = startY + cardHeight + 3;

  const conditionLabels = [
    "Kebersihan",
    "Bunyi Mesin",
    "Asap Kendaraan",
    "Bau",
    "Kebocoran",
    "Tetesan Oli",
    "Uji Emisi/KIR",
  ];
  const conditionOptions = [
    ["Ya", "Tidak"],
    ["Berisik", "Tidak"],
    ["Hitam", "Tidak"],
    ["Ya", "Tidak"],
    ["Ya", "Tidak"],
    ["Ya", "Tidak"],
    ["Ya", "Tidak"],
  ];

  drawPdfCell(pdf, left, y, totalWidth, 6, "Kondisi Kendaraan *", { align: "center", bold: true, fontSize: 7.5 });
  y += 6;

  const conditionWidth = totalWidth / conditionLabels.length;
  conditionLabels.forEach((label, index) => {
    const x = left + index * conditionWidth;
    drawPdfCell(pdf, x, y, conditionWidth, 6, label, { align: "center", bold: true, fontSize: 5.6 });
    drawPdfCell(pdf, x, y + 6, conditionWidth / 2, 5.5, conditionOptions[index][0], { align: "center", fontSize: 5.5 });
    drawPdfCell(pdf, x + conditionWidth / 2, y + 6, conditionWidth / 2, 5.5, conditionOptions[index][1], { align: "center", fontSize: 5.5 });
  });
  y += 14;

  const notesWidth = 118;
  const signatureWidth = totalWidth - notesWidth;
  const bulletText = [
    "Pencatatan suhu dilakukan untuk produk dengan temperatur khusus (2-8 C atau <25 C).",
    "C atau c adalah koli.",
    'Isi "v" pada ceklist pengecekan kondisi produk apabila seluruh parameter telah sesuai.',
    'Isi "X" pada ceklist apabila terdapat ketidaksesuaian dan detailkan ketidaksesuaian tersebut pada kolom Catatan.',
  ];

  drawPdfCell(pdf, left, y, notesWidth, 28, "", { valign: "top" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.8);
  pdf.text("Keterangan:", left + 2, y + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.8);
  let bulletY = y + 8;
  bulletText.forEach((item) => {
    const wrapped = pdf.splitTextToSize(`- ${item}`, notesWidth - 4);
    pdf.text(wrapped, left + 2, bulletY);
    bulletY += wrapped.length * 2.9 + 0.5;
  });

  drawPdfCell(pdf, left + notesWidth, y, signatureWidth, 6, "Paraf Petugas", { align: "center", bold: true, fontSize: 7.5 });
  drawPdfCell(pdf, left + notesWidth, y + 6, signatureWidth / 2, 16, "");
  drawPdfCell(pdf, left + notesWidth + signatureWidth / 2, y + 6, signatureWidth / 2, 16, "");
  drawPdfCell(pdf, left + notesWidth, y + 22, signatureWidth / 2, 6, "Worker", { align: "center", bold: true, fontSize: 6.5 });
  drawPdfCell(pdf, left + notesWidth + signatureWidth / 2, y + 22, signatureWidth / 2, 6, "ERP Support", { align: "center", bold: true, fontSize: 6.5 });
}

async function generateShippingFormPdf(form: ShippingHeaderForm, selectedPlanId: string) {
  const pdf = new jsPDF("p", "mm", "a4");
  const logoDataUrl = await loadImageAsDataUrl("/logo/site_logo.png");

  const tableStartY = renderShippingHeaderPdf(pdf, form, logoDataUrl) + 2;
  const notesStartY = renderProductTablePdf(pdf, tableStartY) + 4;
  renderNotesAndSignaturePdf(pdf, notesStartY);

  const fileName = selectedPlanId
    ? `container-load-form-${selectedPlanId}.pdf`
    : "container-load-form.pdf";

  pdf.save(fileName);
}

export default function ShippingContainerLoadFormPage() {
  const searchParams = useSearchParams();
  const selectedPlanId = searchParams.get("id")?.trim() ?? "";

  return <ShippingContainerLoadFormContent key={selectedPlanId || "new"} selectedPlanId={selectedPlanId} />;
}

function ShippingContainerLoadFormContent({ selectedPlanId }: { selectedPlanId: string }) {
  const [form, setForm] = useState<ShippingHeaderForm>(getShippingHeaderForm(selectedPlanId));
  const [isPrinting, setIsPrinting] = useState(false);

  function handleChange(field: keyof ShippingHeaderForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handlePrint() {
    if (isPrinting) {
      return;
    }

    try {
      setIsPrinting(true);
      await generateShippingFormPdf(form, selectedPlanId);
    } finally {
      setIsPrinting(false);
    }
  }

  return (
    <div className="print-form-root min-h-screen p-6 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-0">
        <div className="flex items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">Form Shipping Container</h1>
            <p className="text-sm text-slate-500">
              {selectedPlanId ? `Header form untuk Plan Shipping ID ${selectedPlanId}` : "Form header shipping baru"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/shipping/container-load">
                <ArrowLeft className="h-4 w-4" />
                Back to List
              </Link>
            </Button>
            <Button type="button">
              <Save className="h-4 w-4" />
              Save Form
            </Button>
            <Button type="button" variant="outline" onClick={handlePrint} disabled={isPrinting}>
              <Printer className="h-4 w-4" />
              {isPrinting ? "Generating PDF..." : "Print Form"}
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm print:rounded-none print:border-slate-300 print:shadow-none dark:border-slate-700 dark:bg-slate-900">
          <div className="grid grid-cols-[110px_minmax(0,1fr)_110px] items-center border-b border-slate-300 dark:border-slate-700">
            <div className="flex h-20 items-center justify-center border-r border-slate-300 px-3 dark:border-slate-700">
              <Image
                src="/logo/site_logo.png"
                alt="Site logo"
                width={72}
                height={72}
                className="h-auto max-h-14 w-auto object-contain"
                priority
              />
            </div>
            <div className="px-4 text-center text-base font-bold uppercase tracking-wide text-slate-700 dark:text-slate-100 md:text-[28px]">
              Formulir Penerimaan / Pengiriman Obat Jadi
            </div>
            <div />
          </div>

          <div className="px-4 py-3">
            {HEADER_ROW_PAIRS.map((row, index) => (
              <HeaderPairRow
                key={`${row.left.field}-${row.right.field}`}
                leftLabel={row.left.label}
                leftValue={form[row.left.field]}
                leftSuffix={row.left.suffix}
                leftRequired={row.left.required}
                leftIsDatePicker={row.left.field === "tanggal"}
                leftIsTimePicker={row.left.field === "jamAwal" || row.left.field === "jamSetelah"}
                onLeftChange={(value) => handleChange(row.left.field, value)}
                rightLabel={row.right.label}
                rightValue={form[row.right.field]}
                rightSuffix={row.right.suffix}
                rightRequired={row.right.required}
                rightIsDatePicker={row.right.field === "tanggalRekalibrasi"}
                rightIsTimePicker={row.right.field === "jamAwal" || row.right.field === "jamSetelah"}
                onRightChange={(value) => handleChange(row.right.field, value)}
                isLastRow={index === HEADER_ROW_PAIRS.length - 1}
              />
            ))}
          </div>

          <div className="border-t border-slate-300 px-4 py-4 text-center text-xl font-bold tracking-wide text-slate-700 dark:border-slate-700 dark:text-slate-100 md:text-2xl">
            <span>{form.alurPengiriman || "PENERIMAAN / PENGIRIMAN"}</span>
            <span className="ml-2 text-red-500">*</span>
          </div>

          <div className="border-t border-slate-300 px-4 py-3 dark:border-slate-700">
            <div className="overflow-hidden border border-slate-300 dark:border-slate-700">
              <div className="grid grid-cols-[120px_280px_minmax(0,1fr)_110px_140px]">
                <div className="row-span-2 flex min-h-20 items-center justify-center border-r border-slate-300 px-3 text-center text-sm font-bold uppercase text-slate-700 dark:border-slate-700 dark:text-slate-100">
                  Batch Number
                </div>
                <div className="row-span-2 flex min-h-20 items-center justify-center border-r border-slate-300 px-3 text-center text-sm font-bold uppercase text-slate-700 dark:border-slate-700 dark:text-slate-100">
                  Quantity MB (C atau c)
                </div>
                <div className="flex min-h-10 items-center justify-center border-r border-b border-slate-300 px-3 text-center text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-100">
                  Pengecekan Kondisi Produk
                </div>
                <div className="flex min-h-10 items-center justify-center border-r border-b border-slate-300 px-3 text-center text-sm font-bold uppercase text-slate-700 dark:border-slate-700 dark:text-slate-100">
                  Qty Full MB
                </div>
                <div className="flex min-h-10 items-center justify-center border-b border-slate-300 px-3 text-center text-sm font-bold uppercase text-slate-700 dark:border-slate-700 dark:text-slate-100">
                  Quantity Pick
                </div>

                <div className="grid grid-cols-4 border-r border-slate-300 dark:border-slate-700">
                  <div className="flex min-h-12 items-center justify-center border-r border-slate-300 px-2 text-center text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    Posisi MB
                  </div>
                  <div className="flex min-h-12 items-center justify-center border-r border-slate-300 px-2 text-center text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    Tumpukan MB
                  </div>
                  <div className="flex min-h-12 items-center justify-center border-r border-slate-300 px-2 text-center text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    Fisik Produk
                  </div>
                  <div className="flex min-h-12 items-center justify-center px-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Label
                  </div>
                </div>
                <div className="flex min-h-12 items-center justify-center border-r border-slate-300 px-2 text-center text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  (Box / Botol / Vial)
                </div>
                <div className="flex min-h-12 items-center justify-center px-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                  (Box / Botol / Vial)
                </div>
              </div>

              {PRODUCT_CHECK_ROWS.map((rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid grid-cols-[120px_280px_minmax(0,1fr)_110px_140px] border-t border-slate-300 dark:border-slate-700"
                >
                  <div className="min-h-10 border-r border-slate-300 dark:border-slate-700" />
                  <div className="min-h-10 border-r border-slate-300 dark:border-slate-700" />
                  <div className="grid grid-cols-4 border-r border-slate-300 dark:border-slate-700">
                    {["posisi", "tumpukan", "fisik", "label"].map((field, fieldIndex) => (
                      <div
                        key={`${field}-${rowIndex}`}
                        className={cn(
                          "flex min-h-10 items-center justify-center",
                          fieldIndex < 3 && "border-r border-slate-300 dark:border-slate-700",
                        )}
                      >
                        <Checkbox
                          aria-label={`Pengecekan ${field} baris ${rowIndex + 1}`}
                          className="size-4 rounded-[2px] border-slate-400 dark:border-slate-500 data-[state=checked]:border-slate-700 data-[state=checked]:bg-slate-700 dark:data-[state=checked]:border-slate-200 dark:data-[state=checked]:bg-slate-200 dark:data-[state=checked]:text-slate-950"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="min-h-10 border-r border-slate-300 dark:border-slate-700" />
                  <div className="min-h-10" />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-300 px-5 py-4 text-slate-700 dark:border-slate-700 dark:text-slate-100">
            <div className="text-lg font-bold uppercase">Catatan</div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Catat pada kolom ini jika terdapat produk kondisi ketidaksesuaian dalam bentuk apa pun atau terjadi penyimpangan.
            </p>

            <div className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-[210px_minmax(0,220px)] items-end gap-3">
                <div className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-100">Nomor seal/segel :</div>
                <Input className="h-8 w-full rounded-none border-0 border-b border-slate-300 bg-transparent px-0 pb-0 text-slate-700 shadow-none focus-visible:ring-0 dark:border-slate-600 dark:bg-transparent dark:text-slate-100" />
              </div>

              <div className="grid grid-cols-[210px_minmax(0,220px)_40px] items-end gap-3">
                <div className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-100">Suhu min. saat penerimaan:</div>
                <Input className="h-8 w-full rounded-none border-0 border-b border-slate-300 bg-transparent px-0 pb-0 text-slate-700 shadow-none focus-visible:ring-0 dark:border-slate-600 dark:bg-transparent dark:text-slate-100" />
                <div className="text-sm font-medium text-slate-600 dark:text-slate-300">C</div>
              </div>

              <div className="grid grid-cols-[210px_minmax(0,220px)_40px] items-end gap-3">
                <div className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-100">Suhu max. saat penerimaan:</div>
                <Input className="h-8 w-full rounded-none border-0 border-b border-slate-300 bg-transparent px-0 pb-0 text-slate-700 shadow-none focus-visible:ring-0 dark:border-slate-600 dark:bg-transparent dark:text-slate-100" />
                <div className="text-sm font-medium text-slate-600 dark:text-slate-300">C</div>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
                <div className="border-b border-slate-300 px-4 py-2 text-center text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-100">
                  Kondisi Kendaraan <span className="text-red-500">*</span>
                </div>
                <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {[
                    { label: "Kebersihan", options: ["Ya", "Tidak"] },
                    { label: "Bunyi Mesin", options: ["Berisik", "Tidak"] },
                    { label: "Asap Kendaraan", options: ["Hitam", "Tidak"] },
                    { label: "Bau", options: ["Ya", "Tidak"] },
                    { label: "Kebocoran", options: ["Ya", "Tidak"] },
                    { label: "Tetesan Oli", options: ["Ya", "Tidak"] },
                    { label: "Uji Emisi/KIR", options: ["Ya", "Tidak"] },
                  ].map((item, index) => (
                    <div key={item.label} className={index === 0 ? "" : "border-l border-slate-300 dark:border-slate-700"}>
                      <div className="border-b border-slate-300 px-2 py-2 dark:border-slate-700">{item.label}</div>
                      <div className="grid grid-cols-2">
                        {item.options.map((option, optionIndex) => (
                          <div
                            key={option}
                            className={cn(
                              "px-2 py-1.5 text-[11px] font-medium",
                              optionIndex === 0 && "border-r border-slate-300 dark:border-slate-700",
                            )}
                          >
                            {option}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
                <div className="px-1 py-2 text-sm text-slate-700 dark:text-slate-200">
                  <div className="font-semibold">Keterangan :</div>
                  <ul className="mt-2 list-disc space-y-2 pl-5">
                    <li>Pencatatan suhu dilakukan untuk produk dengan temperatur khusus (2-8°C atau &lt;25°C).</li>
                    <li>C atau c adalah koli.</li>
                    <li>Isi &quot;√&quot; pada ceklist pengecekan kondisi produk apabila seluruh parameter telah sesuai.</li>
                    <li>Isi &quot;X&quot; pada ceklist apabila terdapat ketidaksesuaian dan detailkan ketidaksesuaian tersebut pada kolom Catatan.</li>
                  </ul>
                </div>

                <div className="overflow-hidden border border-slate-300 dark:border-slate-700">
                  <div className="border-b border-slate-300 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:text-slate-100">
                    Paraf Petugas
                  </div>
                  <div className="grid min-h-[96px] grid-cols-2">
                    <div className="border-r border-slate-300 dark:border-slate-700" />
                    <div />
                  </div>
                  <div className="grid grid-cols-2 border-t border-slate-300 text-center text-sm font-bold uppercase text-slate-700 dark:border-slate-700 dark:text-slate-100">
                    <div className="border-r border-slate-300 px-3 py-2 dark:border-slate-700">Worker</div>
                    <div className="px-3 py-2">ERP Support</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          .print-form-root,
          .print-form-root * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

function HeaderPairRow({
  leftLabel,
  leftValue,
  leftSuffix,
  leftRequired,
  leftIsDatePicker,
  leftIsTimePicker,
  onLeftChange,
  rightLabel,
  rightValue,
  rightSuffix,
  rightRequired,
  rightIsDatePicker,
  rightIsTimePicker,
  onRightChange,
  isLastRow,
}: {
  leftLabel: string;
  leftValue: string;
  leftSuffix?: string;
  leftRequired?: boolean;
  leftIsDatePicker?: boolean;
  leftIsTimePicker?: boolean;
  onLeftChange: (value: string) => void;
  rightLabel: string;
  rightValue: string;
  rightSuffix?: string;
  rightRequired?: boolean;
  rightIsDatePicker?: boolean;
  rightIsTimePicker?: boolean;
  onRightChange: (value: string) => void;
  isLastRow?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 items-stretch md:grid-cols-2 ${isLastRow ? "" : "border-b border-slate-300 dark:border-slate-700"}`}>
      <HeaderCell
        label={leftLabel}
        value={leftValue}
        suffix={leftSuffix}
        required={leftRequired}
        onChange={onLeftChange}
        isDatePicker={leftIsDatePicker}
        isTimePicker={leftIsTimePicker}
      />
      <HeaderCell
        label={rightLabel}
        value={rightValue}
        suffix={rightSuffix}
        required={rightRequired}
        onChange={onRightChange}
        isDatePicker={rightIsDatePicker}
        isTimePicker={rightIsTimePicker}
        withLeftDivider
      />
    </div>
  );
}

function HeaderCell({
  label,
  value,
  suffix,
  required = false,
  isDatePicker = false,
  isTimePicker = false,
  onChange,
  withLeftDivider = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  required?: boolean;
  isDatePicker?: boolean;
  isTimePicker?: boolean;
  onChange: (value: string) => void;
  withLeftDivider?: boolean;
}) {
  const selectedDate = isDatePicker ? parseDisplayDate(value) : undefined;
  const selectedTime = isTimePicker ? getTimeParts(value) : null;

  return (
    <div className={`grid grid-cols-[260px_20px_minmax(0,1fr)] items-stretch ${withLeftDivider ? "md:border-l md:border-slate-300 dark:md:border-slate-700" : ""}`}>
      <div className="flex items-center gap-1 whitespace-nowrap px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-100 sm:text-xs">
        <span>{label}</span>
        {required ? <span className="text-red-500">*</span> : null}
      </div>
      <div className="flex items-center justify-center whitespace-nowrap px-1 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400">:</div>
      <div className="min-w-0 border-l border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        {isDatePicker ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-10 w-full justify-start rounded-none border-0 bg-white px-4 text-left font-normal text-slate-700 shadow-none hover:bg-slate-50 focus-visible:ring-0 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
                  !value && "text-slate-400",
                )}
              >
                <CalendarIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                {value || "Pilih tanggal"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto border border-slate-200 bg-white p-0 text-slate-700 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => onChange(date ? format(date, "dd MMM yyyy") : "")}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        ) : isTimePicker ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-10 w-full justify-start rounded-none border-0 bg-white px-4 text-left font-normal text-slate-700 shadow-none hover:bg-slate-50 focus-visible:ring-0 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
                  !value && "text-slate-400",
                )}
              >
                <Clock3 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                {value || "Pilih jam"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] border border-slate-200 bg-white p-3 text-slate-700 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" align="start">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pilih jam</div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <select
                    value={selectedTime?.hour ?? "00"}
                    onChange={(event) => onChange(buildDisplayTime(event.target.value, selectedTime?.minute ?? "00"))}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-none outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
                  >
                    {Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, "0")).map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">.</span>
                  <select
                    value={selectedTime?.minute ?? "00"}
                    onChange={(event) => onChange(buildDisplayTime(selectedTime?.hour ?? "00", event.target.value))}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-none outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
                  >
                    {Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, "0")).map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Format 24 jam, contoh 13.00 atau 22.35.</div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="relative">
            <Input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className={`h-10 whitespace-nowrap rounded-none border-0 bg-white px-4 text-slate-700 shadow-none focus-visible:ring-0 dark:bg-slate-900 dark:text-slate-100 ${suffix ? "pr-16" : ""}`}
            />
            {suffix ? (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center whitespace-nowrap bg-white px-4 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300 sm:text-sm">
                {suffix}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
