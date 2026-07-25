import jsPDF from "jspdf";
import type { Report } from "./reports";
import { VENDOR_LABELS, formatDateTime } from "./reports";
import { formatNaira } from "./store";

export function generateReportPdf(report: Report): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = 40;

  const brandNavy: [number, number, number] = [15, 34, 68];
  const brandGold: [number, number, number] = [201, 162, 39];
  const muted: [number, number, number] = [110, 116, 130];

  // Header
  doc.setFillColor(...brandNavy);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("CGCC Cafeteria Express", M, 40);
  doc.setTextColor(...brandGold);
  doc.setFontSize(12);
  doc.text("Sales Report", M, 60);
  doc.setTextColor(230, 230, 230);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - M, 40, { align: "right" });

  y = 120;

  // Meta
  doc.setTextColor(...brandNavy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(VENDOR_LABELS[report.scope], M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(
    `${report.rangeLabel} · ${new Date(report.from).toLocaleDateString()} – ${new Date(report.to - 1).toLocaleDateString()}`,
    M,
    y,
  );
  y += 20;

  // KPI grid
  const kpis: [string, string][] = [
    ["Orders Received", String(report.ordersReceived)],
    ["Completed", String(report.ordersCompleted)],
    ["Pending", String(report.ordersPending)],
    ["Cancelled", String(report.ordersCancelled)],
    ["Items Sold", String(report.itemsSold)],
    ["Revenue", formatNaira(report.revenue)],
    ["Collected", String(report.collected)],
    ["Not Collected", String(report.notCollected)],
  ];
  const cols = 4;
  const cellW = (pageW - M * 2) / cols;
  const cellH = 44;
  kpis.forEach((kv, i) => {
    const cx = M + (i % cols) * cellW;
    const cy = y + Math.floor(i / cols) * cellH;
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(cx + 2, cy, cellW - 4, cellH - 6, 4, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(kv[0].toUpperCase(), cx + 10, cy + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...brandNavy);
    doc.text(kv[1], cx + 10, cy + 32);
  });
  y += Math.ceil(kpis.length / cols) * cellH + 10;

  // Orders table
  const drawTableHead = () => {
    doc.setFillColor(...brandNavy);
    doc.rect(M, y, pageW - M * 2, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("CODE", M + 8, y + 13);
    doc.text("DATE / TIME", M + 70, y + 13);
    doc.text("CUSTOMER", M + 210, y + 13);
    doc.text("ITEMS", M + 320, y + 13);
    doc.text("PAY", pageW - M - 110, y + 13, { align: "right" });
    doc.text("STATUS", pageW - M - 70, y + 13, { align: "right" });
    doc.text("AMOUNT", pageW - M - 8, y + 13, { align: "right" });
    y += 20;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...brandNavy);
  doc.text("Orders", M, y);
  y += 8;
  drawTableHead();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  report.orders.forEach((o, idx) => {
    if (y > pageH - 100) {
      doc.addPage();
      y = 40;
      drawTableHead();
    }
    if (idx % 2 === 1) {
      doc.setFillColor(246, 247, 250);
      doc.rect(M, y, pageW - M * 2, 20, "F");
    }
    const total = o.items.reduce((s, i) => s + i.price * i.qty, 0);
    const itemsStr = o.items.map((i) => `${i.qty}×${i.name}`).join(", ");
    doc.text(o.code, M + 8, y + 13);
    doc.text(formatDateTime(o.createdAt), M + 70, y + 13);
    doc.text(o.customerName.slice(0, 18), M + 210, y + 13);
    doc.text(itemsStr.slice(0, 26), M + 320, y + 13);
    doc.text(o.paymentStatus, pageW - M - 110, y + 13, { align: "right" });
    doc.text(o.pickupStatus, pageW - M - 70, y + 13, { align: "right" });
    doc.text(formatNaira(total), pageW - M - 8, y + 13, { align: "right" });
    y += 20;
  });

  y += 12;
  if (y > pageH - 200) {
    doc.addPage();
    y = 40;
  }

  // Product summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...brandNavy);
  doc.text("Product Summary", M, y);
  y += 12;
  doc.setFillColor(...brandNavy);
  doc.rect(M, y, pageW - M * 2, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("PRODUCT", M + 8, y + 13);
  doc.text("QTY SOLD", pageW - M - 130, y + 13, { align: "right" });
  doc.text("REVENUE", pageW - M - 8, y + 13, { align: "right" });
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  report.productSummary.forEach((p, idx) => {
    if (y > pageH - 60) {
      doc.addPage();
      y = 40;
    }
    if (idx % 2 === 1) {
      doc.setFillColor(246, 247, 250);
      doc.rect(M, y, pageW - M * 2, 20, "F");
    }
    doc.text(p.name, M + 8, y + 13);
    doc.text(String(p.qty), pageW - M - 130, y + 13, { align: "right" });
    doc.text(formatNaira(p.revenue), pageW - M - 8, y + 13, { align: "right" });
    y += 20;
  });

  return doc;
}

export function downloadReportPdf(report: Report) {
  const doc = generateReportPdf(report);
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`CGCC-report-${report.scope}-${stamp}.pdf`);
}
