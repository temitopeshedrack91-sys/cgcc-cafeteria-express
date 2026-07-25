import jsPDF from "jspdf";
import type { CashierSale } from "./cashier-sales";
import { paymentLabel } from "./cashier-sales";
import { formatNaira } from "./store";

export function generateCashierReceiptPdf(sale: CashierSale): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 40;

  const brandNavy: [number, number, number] = [15, 34, 68];
  const brandGold: [number, number, number] = [201, 162, 39];
  const muted: [number, number, number] = [110, 116, 130];

  doc.setFillColor(...brandNavy);
  doc.rect(0, 0, pageW, 100, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Citadel Global Community Church", M, 46);
  doc.setTextColor(...brandGold);
  doc.setFontSize(11);
  doc.text("CGCC Cafeteria Express · Walk-in Sale", M, 66);
  doc.setTextColor(230, 230, 230);
  doc.setFontSize(9);
  doc.text("CASHIER RECEIPT", M, 84);

  y = 130;
  doc.setTextColor(...brandNavy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(sale.code, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(`Receipt: ${sale.receipt_no}`, M, y + 16);
  doc.text(new Date(sale.created_at).toLocaleString(), pageW - M, y + 16, { align: "right" });

  y += 40;
  doc.setDrawColor(220, 220, 220);
  doc.line(M, y, pageW - M, y);
  y += 18;

  const kv = (l: string, v: string, x: number, yy: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(l.toUpperCase(), x, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(v, x, yy + 14);
  };
  const colW = (pageW - M * 2) / 2;
  kv("Customer", sale.customer_name || "Walk-in", M, y);
  kv("Payment Method", paymentLabel(sale.payment_method), M + colW, y);
  y += 36;
  kv("Served By", sale.cashier_label ?? "Cashier", M, y);
  y += 30;

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
  sale.items.forEach((it, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(246, 247, 250);
      doc.rect(M, y, pageW - M * 2, 22, "F");
    }
    doc.text(it.name, M + 10, y + 15);
    doc.text(String(it.qty), pageW - M - 200, y + 15, { align: "right" });
    doc.text(formatNaira(it.price), pageW - M - 110, y + 15, { align: "right" });
    doc.text(formatNaira(it.price * it.qty), pageW - M - 10, y + 15, { align: "right" });
    y += 22;
  });

  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, pageW - M, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...brandNavy);
  doc.text("TOTAL PAID", M, y);
  doc.setFontSize(16);
  doc.text(formatNaira(sale.total), pageW - M, y, { align: "right" });

  y += 40;
  doc.setFillColor(246, 247, 250);
  doc.rect(0, y, pageW, 70, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...brandNavy);
  doc.text("Thank you and God bless.", M, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("CGCC Cafeteria Express · Walk-in Receipt", M, y + 42);

  return doc;
}

export function downloadCashierReceiptPdf(sale: CashierSale) {
  const doc = generateCashierReceiptPdf(sale);
  doc.save(`CGCC-${sale.code}.pdf`);
}
