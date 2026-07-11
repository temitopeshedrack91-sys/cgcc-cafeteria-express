import jsPDF from "jspdf";
import type { Order } from "./store";
import { formatNaira } from "./store";
import logoAsset from "@/assets/cgcc_logo.png.asset.json";

const BUSINESS_WHATSAPP = "09134749319";
const PAYMENT_METHOD = "OPay Transfer";

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(logoAsset.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateReceiptPdf(order: Order): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 40;

  // Brand colors
  const brandNavy: [number, number, number] = [15, 34, 68];
  const brandGold: [number, number, number] = [201, 162, 39];
  const muted: [number, number, number] = [110, 116, 130];

  // Header band
  doc.setFillColor(...brandNavy);
  doc.rect(0, 0, pageW, 110, "F");

  const logo = await loadLogoDataUrl();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", M, 28, 54, 54);
    } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Citadel Global Community Church", M + 68, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...brandGold);
  doc.text("CGCC Cafeteria Express", M + 68, 70);
  doc.setTextColor(230, 230, 230);
  doc.setFontSize(9);
  doc.text("PAYMENT RECEIPT", M + 68, 86);

  y = 140;

  // Order code big
  doc.setTextColor(...brandNavy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(order.code, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(`Receipt No: ${order.receiptNo}`, M, y + 16);
  const dt = new Date(order.createdAt).toLocaleString();
  doc.text(dt, pageW - M, y + 16, { align: "right" });

  y += 40;
  doc.setDrawColor(220, 220, 220);
  doc.line(M, y, pageW - M, y);
  y += 18;

  // Customer details grid
  const drawKV = (label: string, value: string, x: number, yy: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(label.toUpperCase(), x, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(value, x, yy + 14);
  };
  const colW = (pageW - M * 2) / 2;
  drawKV("Customer", order.customerName, M, y);
  drawKV("Phone", order.phone, M + colW, y);
  y += 36;
  drawKV(
    "Order Type",
    order.orderType === "dine-in" ? "Eat-in" : "Takeaway",
    M,
    y,
  );
  drawKV("Payment Method", PAYMENT_METHOD, M + colW, y);
  y += 36;
  drawKV("Payment Status", order.paymentStatus.toUpperCase(), M, y);
  drawKV("Pickup Status", order.pickupStatus.toUpperCase(), M + colW, y);
  y += 30;

  if (order.note) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Note: ${order.note}`, M, y);
    y += 18;
  }

  y += 8;
  // Items table header
  doc.setFillColor(...brandNavy);
  doc.rect(M, y, pageW - M * 2, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ITEM", M + 10, y + 15);
  doc.text("QTY", pageW - M - 200, y + 15, { align: "right" });
  doc.text("UNIT", pageW - M - 110, y + 15, { align: "right" });
  doc.text("AMOUNT", pageW - M - 10, y + 15, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  order.items.forEach((it, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(246, 247, 250);
      doc.rect(M, y, pageW - M * 2, 22, "F");
    }
    doc.text(it.name, M + 10, y + 15);
    doc.text(String(it.qty), pageW - M - 200, y + 15, { align: "right" });
    doc.text(formatNaira(it.price), pageW - M - 110, y + 15, { align: "right" });
    doc.text(formatNaira(it.price * it.qty), pageW - M - 10, y + 15, {
      align: "right",
    });
    y += 22;
  });

  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, pageW - M, y);
  y += 22;

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...brandNavy);
  doc.text("TOTAL AMOUNT", M, y);
  doc.setFontSize(16);
  doc.text(formatNaira(order.total), pageW - M, y, { align: "right" });

  y += 40;
  // Footer band
  doc.setFillColor(246, 247, 250);
  doc.rect(0, y, pageW, 90, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...brandNavy);
  doc.text("Thank you and God bless.", M, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`Business WhatsApp: ${BUSINESS_WHATSAPP}`, M, y + 42);
  doc.text(
    "Please present this receipt (code or PDF) at the cafeteria counter.",
    M,
    y + 58,
  );

  return doc;
}

export async function downloadReceiptPdf(order: Order) {
  const doc = await generateReceiptPdf(order);
  doc.save(`CGCC-${order.code}.pdf`);
}
