import * as XLSX from "xlsx";
import type { Report } from "./reports";
import { VENDOR_LABELS, formatDateTime } from "./reports";

export function downloadReportXlsx(report: Report) {
  const wb = XLSX.utils.book_new();

  const summary = [
    ["CGCC Cafeteria Express — Sales Report"],
    ["Vendor", VENDOR_LABELS[report.scope]],
    ["Range", report.rangeLabel],
    ["From", new Date(report.from).toLocaleString()],
    ["To", new Date(report.to - 1).toLocaleString()],
    ["Generated", new Date().toLocaleString()],
    [],
    ["Orders Received", report.ordersReceived],
    ["Orders Completed", report.ordersCompleted],
    ["Orders Pending", report.ordersPending],
    ["Cancelled Orders", report.ordersCancelled],
    ["Items Sold", report.itemsSold],
    ["Revenue (NGN)", report.revenue],
    ["Collected", report.collected],
    ["Not Collected", report.notCollected],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 26 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  const ordersHeader = [
    "Code",
    "Date/Time",
    "Customer",
    "Phone",
    "Pickup Time",
    "Payment",
    "Status",
    "Items",
    "Qty",
    "Amount (NGN)",
  ];
  const ordersRows = report.orders.map((o) => {
    const qty = o.items.reduce((s, i) => s + i.qty, 0);
    const total = o.items.reduce((s, i) => s + i.price * i.qty, 0);
    const itemsStr = o.items.map((i) => `${i.qty}× ${i.name}`).join("; ");
    return [
      o.code,
      formatDateTime(o.createdAt),
      o.customerName,
      o.phone ?? "",
      o.pickupTime ?? "",
      o.paymentStatus,
      o.pickupStatus,
      itemsStr,
      qty,
      total,
    ];
  });
  const ordersSheet = XLSX.utils.aoa_to_sheet([ordersHeader, ...ordersRows]);
  ordersSheet["!cols"] = ordersHeader.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");

  const productHeader = ["Product", "Quantity Sold", "Revenue (NGN)"];
  const productRows = report.productSummary.map((p) => [p.name, p.qty, p.revenue]);
  const productSheet = XLSX.utils.aoa_to_sheet([productHeader, ...productRows]);
  productSheet["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, productSheet, "Product Summary");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `CGCC-report-${report.scope}-${stamp}.xlsx`);
}
