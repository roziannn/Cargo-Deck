"use client";

import jsPDF from "jspdf";

type HeaderData = {
  productName: string;
  batchNo: string;
  ppiRuah: string;
  ppiKemas: string;
  keterangan: string;
};

type BatchRow = {
  id: number;
  productName: string;
  batchNo: string;
  createdBy: string;
  createdAt: string;
  status: string;
};

type GenerateTrendPayload = {
  header: HeaderData;
  batches: BatchRow[];
  parameters: string[];
  attributes: string[];
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

function generateBatchTrendChart(title: string, batches: BatchRow[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 320;

  const ctx = canvas.getContext("2d")!;

  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 40;
  const paddingBottom = 140;

  const chartWidth = canvas.width - paddingLeft - paddingRight;
  const chartHeight = canvas.height - paddingTop - paddingBottom;

  const SAMPLE_COUNT = 30;

  const batchLabels = Array.from({ length: SAMPLE_COUNT }).map((_, i) => {
    if (batches[i]) return batches[i].batchNo;
    return `BN-${(i + 1).toString().padStart(2, "0")}`;
  });

  const values = batchLabels.map(() => Math.round(380 + Math.random() * 40));

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000";
  ctx.font = "bold 16px Arial";
  ctx.fillText(title, paddingLeft, 24);

  const minY = Math.min(...values);
  const maxY = Math.max(...values);

  const yMin = Math.floor((minY - 10) / 10) * 10;
  const yMax = Math.ceil((maxY + 10) / 10) * 10;

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, paddingTop + chartHeight);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartHeight);
  ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
  ctx.stroke();

  ctx.save();
  ctx.translate(18, paddingTop + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = "12px Arial";
  ctx.fillText("Nilai", 0, 0);
  ctx.restore();

  ctx.font = "12px Arial";
  ctx.fillText("Batch", paddingLeft + chartWidth / 2 - 15, paddingTop + chartHeight + 50);

  ctx.font = "11px Arial";

  const gridCount = 5;

  for (let i = 0; i <= gridCount; i++) {
    const v = yMin + ((yMax - yMin) / gridCount) * i;
    const y = paddingTop + chartHeight - (i / gridCount) * chartHeight;

    ctx.fillText(v.toFixed(0), 25, y + 4);

    ctx.strokeStyle = "#ddd";
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(paddingLeft + chartWidth, y);
    ctx.stroke();
  }

  const stepX = batchLabels.length === 1 ? 0 : chartWidth / (batchLabels.length - 1);

  ctx.font = "10px Arial";
  ctx.textAlign = "center";

  batchLabels.forEach((label, i) => {
    const x = paddingLeft + i * stepX;
    const y = paddingTop + chartHeight + 95;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  ctx.textAlign = "left";

  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 2;

  ctx.beginPath();

  values.forEach((v, i) => {
    const x = paddingLeft + i * stepX;
    const y = paddingTop + chartHeight - ((v - yMin) / (yMax - yMin)) * chartHeight;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  ctx.fillStyle = "#f97316";

  values.forEach((v, i) => {
    const x = paddingLeft + i * stepX;
    const y = paddingTop + chartHeight - ((v - yMin) / (yMax - yMin)) * chartHeight;

    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  return canvas.toDataURL("image/png");
}

export async function generateTrendReport(payload: GenerateTrendPayload, printNo: number = 1) {
  const { header, batches, parameters, attributes } = payload;

  if (!batches.length) {
    alert("Batch belum dipilih");
    return;
  }

  if (!parameters.length) {
    alert("Parameter belum dipilih");
    return;
  }

  if (!attributes.length) {
    alert("Attribute belum dipilih");
    return;
  }

  const charts = [
    ...parameters.map((p) => ({
      title: p,
      imageBase64: generateBatchTrendChart(p, batches),
    })),
    ...attributes.map((a) => ({
      title: a,
      imageBase64: generateBatchTrendChart(a, batches),
    })),
  ];

  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const logo = await loadImage("/logo/site_logo.png");
  doc.addImage(logo, "PNG", 14, 12, 22, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("LEMBAR EVALUASI CONTROL CHART & CPK", pageWidth / 2, 19, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("(ON GOING PROCESS VERIFICATION)", pageWidth / 2, 25, { align: "center" });

  let y = 36;
  doc.setFontSize(9);

  doc.text("Product Name", 14, y);
  doc.text(`: ${header.productName}`, 45, y);

  doc.text("Batch No", 120, y);
  const lastBatchNo = batches[batches.length - 1]?.batchNo ?? "";
  doc.text(`: ${lastBatchNo}`, 145, y);

  y += 6;

  doc.text("PPI Ruah No", 14, y);
  doc.text(`: ${header.ppiRuah}`, 45, y);

  doc.text("Keterangan", 120, y);
  doc.text(`: ${header.keterangan}`, 145, y);

  y += 6;

  doc.text("PPI Kemas No", 14, y);
  doc.text(`: ${header.ppiKemas}`, 45, y);

  let currentY = y + 12;

  const marginX = 14;
  const imageWidth = pageWidth - marginX * 2;
  const imageHeight = 60;

  charts.forEach((item, index) => {
    if (currentY + imageHeight + 18 > pageHeight) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${index + 1}. Grafik ${item.title}`, marginX, currentY);

    currentY += 4;

    doc.addImage(item.imageBase64, "PNG", marginX, currentY, imageWidth, imageHeight);

    currentY += imageHeight + 8;
  });

  const signWidth = 60;
  const gap = 20;
  const rightMargin = 14;

  const rightX = pageWidth - rightMargin - signWidth;
  const leftX = rightX - gap - signWidth;

  let signY = currentY;

  if (signY + 30 > pageHeight) {
    doc.addPage();
    signY = 30;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text("(Tanggal, Paraf, Inisial)", leftX, signY);
  doc.text("(Tanggal, Paraf, Inisial)", rightX, signY);

  const lineY = signY + 18;

  doc.line(leftX, lineY, leftX + signWidth, lineY);
  doc.line(rightX, lineY, rightX + signWidth, lineY);

  const titleY = lineY + 6;

  doc.text("QA Line NBL Injeksi Supervisor", leftX, titleY);
  doc.text("QA PQR & Cleaning Validation Supervisor", rightX, titleY);

  const pageCount = doc.getNumberOfPages();

  const generatedAt = new Date().toLocaleString("id-ID");

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setFontSize(8);

    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, 10, {
      align: "right",
    });

    doc.text(`Cetakan ke-${printNo}, dicetak oleh FIRDA ROSIANA TANJUNG, pada ${generatedAt}`, 14, pageHeight - 10);
  }

  doc.save("trend-report.pdf");
}