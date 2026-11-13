import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { computeReport, type ReportOrder } from "./reports";
import {
  ITEMISED_HEADERS,
  buildItemisedExportData,
  buildReportWorkbook,
  formatExcelDateTime,
  type CategoryExportMeta,
  type ProductExportMeta,
} from "./report-xlsx";
import { DEFAULT_SETTINGS } from "./settings";
import { findCartStockIssues, formatStockIssueMessage } from "./stock-guard";

const productMeta = new Map<string, ProductExportMeta>([
  ["m1", { costPrice: 510, categoryId: "cat_food", vendorType: "food" }],
  ["m2", { costPrice: 510, categoryId: "cat_food", vendorType: "food" }],
  ["p2", { costPrice: 1275, categoryId: "cat_food", vendorType: "food" }],
  ["sp1", { costPrice: 850, categoryId: "cat_snacks", vendorType: "snacks" }],
  ["sp2", { costPrice: 850, categoryId: "cat_snacks", vendorType: "snacks" }],
  ["ct1", { costPrice: 595, categoryId: "cat_coffee", vendorType: "coffee" }],
  ["dr1", { costPrice: 425, categoryId: "cat_drinks", vendorType: "drinks" }],
  ["w1", { costPrice: 170, categoryId: "cat_drinks", vendorType: "drinks" }],
  ["sw_custom", { costPrice: 425, categoryId: "cat_sweets", vendorType: "snacks" }],
]);

const categories: CategoryExportMeta[] = [
  { id: "cat_food", name: "Food", sortOrder: 1 },
  { id: "cat_snacks", name: "Snacks", sortOrder: 2 },
  { id: "cat_coffee", name: "Coffee & Tea", sortOrder: 3 },
  { id: "cat_drinks", name: "Drinks", sortOrder: 4 },
  { id: "cat_sweets", name: "Sweets", sortOrder: 5 },
];

const t1 = Date.UTC(2026, 10, 1, 10, 15, 5); // 2026-11-01 11:15:05 Africa/Lagos (UTC+1)
const t2 = Date.UTC(2026, 10, 1, 11, 57, 2); // 2026-11-01 12:57:02 Africa/Lagos (UTC+1)
const from = Date.UTC(2026, 10, 1, 0, 0, 0);
const to = Date.UTC(2026, 10, 2, 0, 0, 0);

const sampleOrders: ReportOrder[] = [
  {
    code: "CG-101",
    customerName: "Grace Adeyemi",
    createdAt: t1,
    paymentStatus: "paid",
    pickupStatus: "collected",
    items: [
      { productId: "m1", name: "Jollof Rice", qty: 2, price: 600, vendorType: "food", categoryId: "cat_food" },
      { productId: "sp1", name: "Meat Pie", qty: 1, price: 1000, vendorType: "snacks", categoryId: "cat_snacks" },
      { productId: "dr1", name: "Coca-Cola (PET)", qty: 2, price: 500, vendorType: "drinks", categoryId: "cat_drinks" },
      { productId: "sw_custom", name: "Chin-Chin Pack", qty: 3, price: 500, vendorType: "snacks", categoryId: "cat_sweets" },
    ],
  },
  {
    code: "CG-102",
    customerName: "Daniel Okoro",
    createdAt: t2,
    paymentStatus: "paid",
    pickupStatus: "confirmed",
    items: [
      { productId: "m2", name: "Fried Rice", qty: 1, price: 600, vendorType: "food", categoryId: "cat_food" },
      { productId: "p2", name: "Chicken (Small)", qty: 1, price: 1500, vendorType: "food", categoryId: "cat_food" },
      { productId: "ct1", name: "Cappuccino", qty: 1, price: 700, vendorType: "coffee", categoryId: "cat_coffee" },
    ],
  },
  {
    code: "CG-103",
    customerName: "Unpaid Order",
    createdAt: t2 + 1000,
    paymentStatus: "unpaid",
    pickupStatus: "pending",
    items: [
      { productId: "m1", name: "Jollof Rice", qty: 5, price: 600, vendorType: "food", categoryId: "cat_food" },
    ],
  },
  {
    code: "CG-104",
    customerName: "Cancelled Paid Order",
    createdAt: t2 + 2000,
    paymentStatus: "paid",
    pickupStatus: "cancelled",
    items: [
      { productId: "m1", name: "Jollof Rice", qty: 4, price: 600, vendorType: "food", categoryId: "cat_food" },
    ],
  },
];

describe("Paid-only vendor and dynamic category reporting", () => {
  it("excludes unpaid and cancelled orders from computeReport sales", () => {
    const report = computeReport({
      orders: sampleOrders,
      scope: "food",
      from,
      to,
      rangeLabel: "Sunday",
    });
    assert.equal(report.ordersReceived, 2);
    assert.equal(report.ordersCancelled, 1);
    assert.equal(report.ordersUnpaid, 1);
    assert.equal(report.itemsSold, 4); // 2 Jollof + 1 Fried Rice + 1 Chicken
    assert.equal(report.revenue, 2 * 600 + 600 + 1500);
  });

  it("isolates dynamic categories such as Sweets cleanly from other items in the same order", () => {
    const sweets = computeReport({
      orders: sampleOrders,
      scope: "cat:cat_sweets",
      scopeLabel: "Sweets Category",
      from,
      to,
      rangeLabel: "Sunday",
    });
    assert.equal(sweets.ordersReceived, 1);
    assert.equal(sweets.itemsSold, 3);
    assert.equal(sweets.revenue, 1500);
    assert.deepEqual(sweets.productSummary, [{ name: "Chin-Chin Pack", qty: 3, revenue: 1500 }]);
  });

  it("formats timestamps as YYYY-MM-DD HH:mm:ss in Africa/Lagos", () => {
    assert.equal(formatExcelDateTime(t2), "2026-11-01 12:57:02");
  });

  it("builds exact 10-column A-J Excel rows newest-first with subtotals", () => {
    const res = buildItemisedExportData({
      orders: sampleOrders,
      scope: "food",
      productMeta,
      settings: DEFAULT_SETTINGS,
    });
    assert.equal(ITEMISED_HEADERS.length, 10);
    assert.equal(res.rows.length, 3);
    // Newest order (CG-102 @ 12:57:02) appears before older order (CG-101 @ 11:15:05)
    assert.equal(res.rows[0]?.[0], "CG-102");
    assert.equal(res.rows[0]?.[1], "2026-11-01 12:57:02");
    assert.equal(res.rows[2]?.[0], "CG-101");
    assert.equal(res.rows[2]?.[3], "m1");
    assert.equal(res.rows[2]?.[4], "Jollof Rice");
    assert.equal(res.rows[2]?.[5], 510);
    assert.equal(res.rows[2]?.[6], 600);
    assert.equal(res.rows[2]?.[7], 2);
    assert.equal(res.rows[2]?.[8], 1020);
    assert.equal(res.rows[2]?.[9], 1200);
    assert.equal(res.totalQty, 4);
    assert.equal(res.totalCost, 510 * 2 + 510 + 1275);
    assert.equal(res.totalSelling, 3300);
  });

  it("puts exact 10-column A-J sheet first and includes dynamic category sheets in Overall workbook", () => {
    const overall = computeReport({
      orders: sampleOrders,
      scope: "all",
      from,
      to,
      rangeLabel: "Sunday",
    });
    const wb = buildReportWorkbook({
      report: overall,
      productMeta,
      categories,
      settings: DEFAULT_SETTINGS,
    });
    assert.equal(wb.SheetNames[0], "Overall Sales");
    assert.ok(wb.SheetNames.includes("Food Vendor"));
    assert.ok(wb.SheetNames.includes("Snacks Vendor"));
    assert.ok(wb.SheetNames.includes("Coffee Vendor"));
    assert.ok(wb.SheetNames.includes("Drinks (Cafeteria Management)"));
    assert.ok(wb.SheetNames.includes("Cat - Sweets"));

    const firstSheet = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
    });
    assert.deepEqual(firstSheet[0], [...ITEMISED_HEADERS]);
    const lastRow = firstSheet[firstSheet.length - 1];
    assert.equal(lastRow?.[4], "TOTAL");
  });
});

describe("Real-time cart stock concurrency guard", () => {
  it("flags sold-out items and insufficient quantities accurately", () => {
    const issues = findCartStockIssues(
      [
        { itemId: "m1", qty: 2 },
        { itemId: "sp1", qty: 1 },
      ],
      [
        { id: "m1", name: "Jollof Rice" },
        { id: "sp1", name: "Meat Pie" },
      ],
      {
        m1: { available: true, stockOnline: 1 },
        sp1: { available: false, stockOnline: 0 },
      },
    );
    assert.equal(issues.length, 2);
    assert.equal(issues[0]?.reason, "insufficient");
    assert.equal(issues[1]?.reason, "sold_out");
    const msg = formatStockIssueMessage(issues);
    assert.match(msg, /Only 1 unit\(s\) of Jollof Rice/);
    assert.match(msg, /Meat Pie was just sold out/);
  });
});
