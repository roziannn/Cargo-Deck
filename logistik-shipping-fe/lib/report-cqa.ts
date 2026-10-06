import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type HeaderData = {
  productName: string;
  batchNo: string;
  ppiRuah: string;
  ppiKemas: string;
  keterangan: string;
};

type RowData = {
  no: number;
  tahapan: string;
  parameter: string;
  tipe: string;
  persyaratan: string;
  hasil: string;
  kesimpulan: string;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

export async function generateCqaReport(header: HeaderData, rows: RowData[], printNo: number = 1) {
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const logo = await loadImage("/logo/site_logo.png");

  const logoWidth = 22;
  const logoHeight = 12;
  const logoX = 14;
  const logoY = 12;

  doc.addImage(logo, "PNG", logoX, logoY, logoWidth, logoHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("LEMBAR EVALUASI CQA", pageWidth / 2, 19, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("(ON GOING PROCESS VERIFICATION)", pageWidth / 2, 25, {
    align: "center",
  });

  let y = 36;
  doc.setFontSize(9);

  // LEFT - Product
  doc.text("Product Name", 14, y);
  const productLines = doc.splitTextToSize(`: ${header.productName}`, 70);
  doc.text(productLines, 45, y);

  // RIGHT - Batch
  doc.text("Batch No", 120, y);
  doc.text(`: ${header.batchNo}`, 145, y);

  y += Math.max(6, productLines.length * 4);

  // LEFT
  doc.text("PPI Ruah No", 14, y);
  doc.text(`: ${header.ppiRuah}`, 45, y);

  // RIGHT - Keterangan
  doc.text("Keterangan", 120, y);
  const ketLines = doc.splitTextToSize(`: ${header.keterangan}`, 55);
  doc.text(ketLines, 145, y);

  y += Math.max(6, ketLines.length * 4);

  // LEFT
  doc.text("PPI Kemas No", 14, y);
  doc.text(`: ${header.ppiKemas}`, 45, y);

  autoTable(doc, {
    startY: y + 10,
    theme: "grid",
    head: [["No", "Tahapan Proses", "Parameter Proses", "Tipe", "Persyaratan", "Hasil", "Kesimpulan"]],
    body: rows.map((r) => [
      r.no,
      r.tahapan,
      r.parameter,
      "CQA", // <-- dipaksa CQA
      r.persyaratan,
      r.hasil,
      r.kesimpulan,
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      textColor: 0,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      halign: "center",
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterTableY = (doc as any).lastAutoTable.finalY + 12;

  // sign area
  // sign area (pojok kanan, 2 kolom berdampingan)
  doc.setFontSize(9);

  const signY = afterTableY;

  const signWidth = 60;
  const gap = 20;
  const rightMargin = 14;

  // kanan
  const rightX = pageWidth - rightMargin - signWidth;
  // kiri (tetap di area kanan, sebelahnya)
  const leftX = rightX - gap - signWidth;

  // label atas
  doc.text("(Tanggal, Paraf, Inisial)", leftX, signY);
  doc.text("(Tanggal, Paraf, Inisial)", rightX, signY);

  // garis tanda tangan
  const lineY = signY + 18;

  doc.line(leftX, lineY, leftX + signWidth, lineY);
  doc.line(rightX, lineY, rightX + signWidth, lineY);

  // jabatan
  const titleY = lineY + 6;

  doc.text("QA Line NBL Injeksi Supervisor", leftX, titleY);
  doc.text("QA PQR & Cleaning Validation Supervisor", rightX, titleY);

  const pageCount = doc.getNumberOfPages();

  const generatedAt = new Date().toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setFontSize(8);
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, 10, { align: "right" });

    // footer
    doc.text(`Cetakan ke-${printNo}, dicetak oleh FIRDA ROSIANA TANJUNG, pada ${generatedAt}`, 14, pageHeight - 10);
  }

  doc.save("Lembar-Evaluasi-CQA.pdf");
}
