import { auditActivityLabel, formatAuditDate, formatAuditTime, timeZoneLabel, type AuditExport } from "@/lib/api/audit-trail";

const COMPANY = "Cargo Deck";
const TITLE = "Laporan Audit Trail";

const periodText = (data: AuditExport) => `${formatAuditDate(`${data.from}T12:00:00Z`, "UTC")} s/d ${formatAuditDate(`${data.to}T12:00:00Z`, "UTC")}`;
const printedText = (data: AuditExport) => `${formatAuditDate(data.printedAt, data.timeZone)} ${formatAuditTime(data.printedAt, data.timeZone).slice(0, 5)} ${timeZoneLabel(data.timeZone)}`;

function filterText(data: AuditExport) {
  const f = data.filters;
  const parts = [f.module && `Modul: ${f.module}`, f.activity && `Aktivitas: ${auditActivityLabel(f.activity)}`, f.user && `Pengguna: ${f.user}`, f.q && `Kata kunci: ${f.q}`].filter(Boolean);
  return parts.length > 0 ? parts.join("  |  ") : "Semua aktivitas";
}

const fileName = (data: AuditExport, extension: string) => `audit-trail_${data.from}_sd_${data.to}.${extension}`;

/** A4 landscape PDF: header with period and print time on every page, zebra table, footer with page numbers. */
export async function downloadAuditPdf(data: AuditExport) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 12;
  const right = pageWidth - 12;
  const ink: [number, number, number] = [30, 41, 59];
  const muted: [number, number, number] = [100, 116, 139];

  const header = () => {
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(COMPANY.toUpperCase(), left, 12);
    doc.setTextColor(...ink);
    doc.setFontSize(16);
    doc.text(TITLE, left, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...ink);
    doc.text(`Periode: ${periodText(data)}`, right, 10, { align: "right" });
    doc.text(`Dicetak: ${printedText(data)}`, right, 15, { align: "right" });
    doc.text(`Dicetak oleh: ${data.printedBy}`, right, 20, { align: "right" });
    doc.text(`Jumlah aktivitas: ${data.rows.length}${data.truncated ? ` dari ${data.total}` : ""}`, right, 25, { align: "right" });

    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.text(filterText(data), left, 25);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(left, 28, right, 28);
  };

  autoTable(doc, {
    startY: 31,
    margin: { top: 31, bottom: 18, left, right },
    head: [["Nama", "Waktu", "Aktivitas", "Modul", "Catatan"]],
    body: data.rows.map((r) => [
      `${r.actorName ?? r.username ?? "Tidak diketahui"}${r.username && r.actorName && r.username !== r.actorName ? `\n(${r.username})` : ""}${r.actorRole ? `\n${r.actorRole}` : ""}`,
      `${formatAuditDate(r.createdDate, data.timeZone)}\n${formatAuditTime(r.createdDate, data.timeZone)}`,
      auditActivityLabel(r.activity),
      r.module,
      r.note,
    ]),
    columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 28 }, 2: { cellWidth: 28 }, 3: { cellWidth: 32 }, 4: { cellWidth: right - left - 134 } },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2, valign: "top", textColor: ink, lineColor: [226, 232, 240], lineWidth: 0.1, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    rowPageBreak: "avoid",
    showHead: "everyPage",
    didDrawPage: header,
  });

  if (data.rows.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text("Tidak ada aktivitas pada periode ini.", left, 45);
  }
  if (data.truncated) {
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`Laporan dibatasi ${data.rows.length} aktivitas pertama dari ${data.total}. Persempit periodenya untuk melihat sisanya.`, left, pageHeight - 22);
  }

  // footer on every page, once the total page count is known
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(left, pageHeight - 14, right, pageHeight - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(`${COMPANY}  |  ${TITLE}  |  Periode ${periodText(data)}`, left, pageHeight - 9);
    doc.text(`Dicetak ${printedText(data)} oleh ${data.printedBy}  |  Dokumen internal, bersifat rahasia`, left, pageHeight - 5.5);
    doc.setFontSize(8);
    doc.setTextColor(...ink);
    doc.text(`Halaman ${page} dari ${pages}`, right, pageHeight - 9, { align: "right" });
  }

  doc.save(fileName(data, "pdf"));
}

/** The same report as a spreadsheet, for filtering and sorting. */
export async function downloadAuditXlsx(data: AuditExport) {
  const XLSX = await import("xlsx");
  const rows: (string | number)[][] = [
    [`${COMPANY} - ${TITLE}`],
    [`Periode: ${periodText(data)}`],
    [`Dicetak: ${printedText(data)} oleh ${data.printedBy}`],
    [`Filter: ${filterText(data)}`],
    [],
    ["Nama", "Username", "Jabatan / Role", "Tanggal", "Jam", "Aktivitas", "Modul", "Referensi", "Catatan"],
    ...data.rows.map((r) => [
      r.actorName ?? r.username ?? "Tidak diketahui",
      r.username ?? "-",
      r.actorRole ?? "-",
      formatAuditDate(r.createdDate, data.timeZone),
      formatAuditTime(r.createdDate, data.timeZone),
      auditActivityLabel(r.activity),
      r.module,
      r.entityRef ?? "",
      r.note,
    ]),
    [],
    [`Total ${data.rows.length} aktivitas${data.truncated ? ` (dibatasi dari ${data.total})` : ""}`],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 90 }];
  sheet["!merges"] = [0, 1, 2, 3].map((r) => ({ s: { r, c: 0 }, e: { r, c: 8 } }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Audit Trail");
  XLSX.writeFile(book, fileName(data, "xlsx"));
}
