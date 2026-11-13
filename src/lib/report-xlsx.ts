import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { Report } from "./reports";
import { VENDOR_LABELS, formatDateTime } from "./reports";
import { currentSettings, loadSettings } from "./settings";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Cost prices keyed by product id. */
async function loadCostPrices(): Promise<Map<string, number>> {
  try {
    const { data, error } = await supabase.from("menu_items").select("id, cost_price");
    if (error) throw error;
    return new Map((data ?? []).map((r: any) => [r.id as string, Number(r.cost_price) || 0]));
  } catch {
    return new Map();
  }
}

export async function downloadReportXlsx(report: Report) {
  const wb = XLSX.utils.book_new();
  const [costByProduct, settings] = await Promise.all([
    loadCostPrices(),
    loadSettings().catch(() => currentSettings()),
  ]);

  let totalCost = 0;
  let totalSelling = 0;
  let id = 0;
  const itemisedRows: (string | number)[][] = [];

  for (const o of [...report.orders].sort((a, b) => a.createdAt - b.createdAt)) {
    if (o.pickupStatus === "cancelled") continue;
    for (const it of o.items) {
      id += 1;
      const code = it.productId ?? "";
      const vKey = (it.vendorType ?? "food") as keyof typeof settings.payoutPercents;
      const rate = settings.payoutPercents[vKey] ?? settings.defaultVendorPayoutPercent ?? 85;
      const savedCost = code ? costByProduct.get(code) : undefined;
      const unitCost =
        savedCost !== undefined && savedCost > 0
          ? round2(savedCost)
          : round2((it.price * rate) / 100);
      const costSub = round2(unitCost * it.qty);
      const sellSub = round2(it.price * it.qty);
      totalCost = round2(totalCost + costSub);
      totalSelling = round2(totalSelling + sellSub);

      itemisedRows.push([
        id,
        formatDateTime(o.createdAt),
        o.customerName,
        code,
        it.name,
        unitCost,
        it.price,
        it.qty,
        costSub,
        sellSub,
        o.code,
        it.vendorType ?? "",
      ]);
    }
  }

  const serviceChargeTotal = round2(totalSelling - totalCost);

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
    ["Selling Total / Gross Revenue (NGN)", totalSelling || report.revenue],
    ["Vendor Share / Cost Sub Total (NGN)", totalCost],
    ["CGCC Service Charge Margin (NGN)", serviceChargeTotal],
    ["Collected", report.collected],
    ["Not Collected", report.notCollected],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 36 }, { wch: 30 }];
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

  const itemisedHeader = [
    "ID",
    "Date",
    "Customer Name",
    "Product Code",
    "Product Name",
    "Cost Price",
    "Selling Price",
    "Quantity",
    "Cost Sub Total",
    "Selling Sub Total",
    "Order Code",
    "Vendor",
  ];
  const totalsRow =
    itemisedRows.length > 0
      ? [["", "", "", "", "TOTAL", "", "", "", totalCost, totalSelling, "", ""]]
      : [];
  const itemisedSheet = XLSX.utils.aoa_to_sheet([
    itemisedHeader,
    ...itemisedRows,
    ...totalsRow,
  ]);
  itemisedSheet["!cols"] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 22 },
    { wch: 14 },
    { wch: 26 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, itemisedSheet, "Itemised Sales");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `CGCC-report-${report.scope}-${stamp}.xlsx`);
}
