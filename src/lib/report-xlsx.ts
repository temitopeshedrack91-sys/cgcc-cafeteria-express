import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { Report, ReportOrder, ReportScope, ReportVendor } from "./reports";
import {
  VENDOR_LABELS,
  formatDateTime,
  getReportScopeLabel,
  isPaidOrder,
  scopeMatches,
} from "./reports";
import { BUSINESS_TZ } from "./business-day";
import { currentSettings, loadSettings, type SystemSettings } from "./settings";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ProductExportMeta = {
  costPrice: number;
  categoryId: string | null;
  vendorType: string | null;
};

export type CategoryExportMeta = {
  id: string;
  name: string;
  sortOrder?: number;
};

const lagosFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Formats a timestamp as `YYYY-MM-DD HH:mm:ss` (Africa/Lagos) for Excel. */
export function formatExcelDateTime(ts: number): string {
  const parts = lagosFormatter.formatToParts(new Date(ts));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

/** Sanitizes an Excel worksheet tab name (<= 31 chars, no []:*?/\). */
export function sanitizeSheetName(raw: string, usedNames?: Set<string>): string {
  const cleaned = raw.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim() || "Sales";
  let candidate = cleaned.slice(0, 31).trim();
  if (!usedNames) return candidate;
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` (${counter})`;
    candidate = `${cleaned.slice(0, Math.max(1, 31 - suffix.length)).trim()}${suffix}`;
    counter += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export const ITEMISED_HEADERS = [
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
] as const;

export function buildItemisedExportData(input: {
  orders: ReportOrder[];
  scope: ReportScope;
  productMeta: Map<string, ProductExportMeta>;
  settings: Pick<SystemSettings, "payoutPercents" | "defaultVendorPayoutPercent">;
}): {
  rows: (string | number)[][];
  totalQty: number;
  totalCost: number;
  totalSelling: number;
} {
  const catMap = new Map<string, string | null>();
  input.productMeta.forEach((v, k) => catMap.set(k, v.categoryId));

  const paidOrders = [...input.orders]
    .filter(isPaidOrder)
    .sort((a, b) => b.createdAt - a.createdAt);

  let totalQty = 0;
  let totalCost = 0;
  let totalSelling = 0;
  const rows: (string | number)[][] = [];

  for (const o of paidOrders) {
    for (const it of o.items) {
      if (!scopeMatches(it, input.scope, catMap)) continue;
      const code = it.productId ?? "";
      const meta = code ? input.productMeta.get(code) : undefined;
      const vKey = (it.vendorType ?? meta?.vendorType ?? "food") as keyof typeof input.settings.payoutPercents;
      const rate =
        input.settings.payoutPercents[vKey] ??
        input.settings.defaultVendorPayoutPercent ??
        85;
      const savedCost = meta?.costPrice;
      const unitCost =
        savedCost !== undefined && savedCost > 0
          ? round2(savedCost)
          : round2((it.price * rate) / 100);
      const costSub = round2(unitCost * it.qty);
      const sellSub = round2(it.price * it.qty);

      totalQty += it.qty;
      totalCost = round2(totalCost + costSub);
      totalSelling = round2(totalSelling + sellSub);

      rows.push([
        o.code,
        formatExcelDateTime(o.createdAt),
        o.customerName || "Online Customer",
        code,
        it.name,
        unitCost,
        it.price,
        it.qty,
        costSub,
        sellSub,
      ]);
    }
  }

  return { rows, totalQty, totalCost, totalSelling };
}

function makeItemisedWorksheet(data: ReturnType<typeof buildItemisedExportData>): XLSX.WorkSheet {
  const totalsRow =
    data.rows.length > 0
      ? [["", "", "", "", "TOTAL", "", "", data.totalQty, data.totalCost, data.totalSelling]]
      : [];
  const sheet = XLSX.utils.aoa_to_sheet([
    [...ITEMISED_HEADERS],
    ...data.rows,
    ...totalsRow,
  ]);
  sheet["!cols"] = [
    { wch: 12 }, // ID
    { wch: 21 }, // Date (YYYY-MM-DD HH:mm:ss)
    { wch: 22 }, // Customer Name
    { wch: 14 }, // Product Code
    { wch: 28 }, // Product Name
    { wch: 12 }, // Cost Price
    { wch: 14 }, // Selling Price
    { wch: 10 }, // Quantity
    { wch: 15 }, // Cost Sub Total
    { wch: 17 }, // Selling Sub Total
  ];
  return sheet;
}

export function buildReportWorkbook(input: {
  report: Report;
  productMeta: Map<string, ProductExportMeta>;
  categories: CategoryExportMeta[];
  settings: SystemSettings;
}): XLSX.WorkBook {
  const { report, productMeta, categories, settings } = input;
  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();
  const scopeLabel = getReportScopeLabel(report.scope, categories, report.scopeLabel);

  // Sheet 1 (Primary): Exact 10-column A-J layout matching CGCC template
  const primaryData = buildItemisedExportData({
    orders: report.orders,
    scope: report.scope,
    productMeta,
    settings,
  });
  const primaryTabName =
    report.scope === "all"
      ? sanitizeSheetName("Overall Sales", usedSheetNames)
      : sanitizeSheetName(scopeLabel, usedSheetNames);
  XLSX.utils.book_append_sheet(wb, makeItemisedWorksheet(primaryData), primaryTabName);

  // When downloading Overall Report, also include one formatted 10-column sheet
  // per Vendor and per active Category that has paid sales in range.
  if (report.scope === "all") {
    const vendors: ReportVendor[] = ["food", "snacks", "coffee", "drinks"];
    for (const v of vendors) {
      const vData = buildItemisedExportData({
        orders: report.orders,
        scope: v,
        productMeta,
        settings,
      });
      if (vData.rows.length > 0) {
        XLSX.utils.book_append_sheet(
          wb,
          makeItemisedWorksheet(vData),
          sanitizeSheetName(VENDOR_LABELS[v], usedSheetNames),
        );
      }
    }

    for (const cat of categories) {
      const cData = buildItemisedExportData({
        orders: report.orders,
        scope: `cat:${cat.id}`,
        productMeta,
        settings,
      });
      if (cData.rows.length > 0) {
        XLSX.utils.book_append_sheet(
          wb,
          makeItemisedWorksheet(cData),
          sanitizeSheetName(`Cat - ${cat.name}`, usedSheetNames),
        );
      }
    }
  }

  const serviceChargeTotal = round2(primaryData.totalSelling - primaryData.totalCost);

  const summary = [
    ["CGCC Cafeteria Express — Paid Sales Report"],
    ["Report Scope", scopeLabel],
    ["Range", report.rangeLabel],
    ["From", formatExcelDateTime(report.from)],
    ["To", formatExcelDateTime(report.to - 1)],
    ["Generated", formatExcelDateTime(Date.now())],
    ["Included Orders", "Paid & non-cancelled orders only"],
    [],
    ["Paid Orders", report.ordersReceived],
    ["Orders Completed", report.ordersCompleted],
    ["Orders Pending Pickup", report.ordersPending],
    ["Cancelled Orders (excluded)", report.ordersCancelled],
    ["Unpaid Orders (excluded)", report.ordersUnpaid],
    ["Items Sold", primaryData.totalQty],
    ["Selling Total / Gross Revenue (NGN)", primaryData.totalSelling],
    ["Vendor Share / Cost Sub Total (NGN)", primaryData.totalCost],
    ["CGCC Service Charge Margin (NGN)", serviceChargeTotal],
    ["Collected", report.collected],
    ["Not Collected", report.notCollected],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 36 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(
    wb,
    summarySheet,
    sanitizeSheetName("Summary", usedSheetNames),
  );

  const ordersHeader = [
    "ID",
    "Date",
    "Customer Name",
    "Phone",
    "Pickup Time",
    "Payment",
    "Pickup Status",
    "Items",
    "Quantity",
    "Amount (NGN)",
  ];
  const paidSorted = [...report.orders]
    .filter(isPaidOrder)
    .sort((a, b) => b.createdAt - a.createdAt);
  const ordersRows = paidSorted.map((o) => {
    const qty = o.items.reduce((s, i) => s + i.qty, 0);
    const total = o.items.reduce((s, i) => s + i.price * i.qty, 0);
    const itemsStr = o.items.map((i) => `${i.qty}× ${i.name}`).join("; ");
    return [
      o.code,
      formatExcelDateTime(o.createdAt),
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
  ordersSheet["!cols"] = [
    { wch: 12 },
    { wch: 21 },
    { wch: 22 },
    { wch: 15 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 36 },
    { wch: 10 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(
    wb,
    ordersSheet,
    sanitizeSheetName("Orders", usedSheetNames),
  );

  const productHeader = ["Product", "Quantity Sold", "Revenue (NGN)"];
  const productRows = report.productSummary.map((p) => [p.name, p.qty, p.revenue]);
  const productSheet = XLSX.utils.aoa_to_sheet([productHeader, ...productRows]);
  productSheet["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(
    wb,
    productSheet,
    sanitizeSheetName("Product Summary", usedSheetNames),
  );

  return wb;
}

async function loadExportMetadata(): Promise<{
  productMeta: Map<string, ProductExportMeta>;
  categories: CategoryExportMeta[];
}> {
  try {
    const [itemsRes, catsRes] = await Promise.all([
      supabase.from("menu_items").select("id, cost_price, category_id, vendor_type"),
      supabase
        .from("categories")
        .select("id, name, sort_order")
        .is("archived_at", null)
        .order("sort_order"),
    ]);
    const productMeta = new Map<string, ProductExportMeta>(
      (
        (itemsRes.data ?? []) as {
          id: string;
          cost_price: number | null;
          category_id: string | null;
          vendor_type: string | null;
        }[]
      ).map((r) => [
        r.id,
        {
          costPrice: Number(r.cost_price) || 0,
          categoryId: r.category_id ?? null,
          vendorType: r.vendor_type ?? null,
        },
      ]),
    );
    const categories: CategoryExportMeta[] = (
      (catsRes.data ?? []) as { id: string; name: string; sort_order: number | null }[]
    ).map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: Number(c.sort_order) || 0,
    }));
    return { productMeta, categories };
  } catch {
    return { productMeta: new Map(), categories: [] };
  }
}

export async function downloadReportXlsx(report: Report) {
  const [{ productMeta, categories }, settings] = await Promise.all([
    loadExportMetadata(),
    loadSettings().catch(() => currentSettings()),
  ]);

  const wb = buildReportWorkbook({
    report,
    productMeta,
    categories,
    settings,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const labelSlug = getReportScopeLabel(report.scope, categories, report.scopeLabel)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  XLSX.writeFile(wb, `CGCC-${labelSlug || report.scope}-${stamp}.xlsx`);
}

// Keep unused-import lint clean for formatDateTime if needed externally
export { formatDateTime };
