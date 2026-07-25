// Pure reporting helpers used by vendor + admin dashboards.

export type ReportVendor = "food" | "snacks" | "coffee" | "drinks";
export type ReportScope = ReportVendor | "all";

export const VENDOR_LABELS: Record<ReportScope, string> = {
  food: "Food Vendor",
  snacks: "Snacks Vendor",
  coffee: "Coffee Vendor",
  drinks: "Drinks (Cafeteria Management)",
  all: "All Vendors",
};

export type ReportItem = {
  name: string;
  qty: number;
  price: number;
  vendorType?: string | null;
  preparationStatus?: string;
};

export type ReportOrder = {
  code: string;
  customerName: string;
  phone?: string;
  createdAt: number;
  pickupTime?: string | null;
  paymentStatus: "paid" | "unpaid";
  pickupStatus: string;
  items: ReportItem[];
};

export type DateRangeKey = "today" | "yesterday" | "week" | "custom";

export function rangeFor(key: DateRangeKey, custom?: { from: number; to: number }) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === "today") {
    return { from: start.getTime(), to: start.getTime() + 24 * 3600 * 1000, label: "Today" };
  }
  if (key === "yesterday") {
    const y = start.getTime() - 24 * 3600 * 1000;
    return { from: y, to: start.getTime(), label: "Yesterday" };
  }
  if (key === "week") {
    // Last 7 days including today
    const from = start.getTime() - 6 * 24 * 3600 * 1000;
    return { from, to: start.getTime() + 24 * 3600 * 1000, label: "This Week" };
  }
  return {
    from: custom?.from ?? start.getTime(),
    to: custom?.to ?? start.getTime() + 24 * 3600 * 1000,
    label: "Custom Range",
  };
}

export function filterOrdersInRange<T extends { createdAt: number }>(
  orders: T[],
  from: number,
  to: number,
): T[] {
  return orders.filter((o) => o.createdAt >= from && o.createdAt < to);
}

export type Report = {
  scope: ReportScope;
  from: number;
  to: number;
  rangeLabel: string;
  ordersReceived: number;
  ordersCompleted: number;
  ordersPending: number;
  ordersCancelled: number;
  itemsSold: number;
  revenue: number;
  collected: number;
  notCollected: number;
  orders: ReportOrder[];
  productSummary: { name: string; qty: number; revenue: number }[];
};

function scopeMatches(item: ReportItem, scope: ReportScope): boolean {
  if (scope === "all") return true;
  if (!item.vendorType) return false;
  return item.vendorType === scope;
}

export function computeReport(input: {
  orders: ReportOrder[];
  scope: ReportScope;
  from: number;
  to: number;
  rangeLabel: string;
}): Report {
  const inRange = filterOrdersInRange(input.orders, input.from, input.to);

  // Filter items per scope and drop orders with no relevant items.
  const scoped: ReportOrder[] = inRange
    .map((o) => ({ ...o, items: o.items.filter((it) => scopeMatches(it, input.scope)) }))
    .filter((o) => o.items.length > 0);

  const productMap = new Map<string, { qty: number; revenue: number }>();
  let itemsSold = 0;
  let revenue = 0;
  let collected = 0;
  let notCollected = 0;
  let completed = 0;
  let pending = 0;
  let cancelled = 0;

  for (const o of scoped) {
    let orderRevenue = 0;
    let allCollected = true;
    for (const it of o.items) {
      itemsSold += it.qty;
      orderRevenue += it.price * it.qty;
      const entry = productMap.get(it.name) ?? { qty: 0, revenue: 0 };
      entry.qty += it.qty;
      entry.revenue += it.price * it.qty;
      productMap.set(it.name, entry);
      if (it.preparationStatus !== "collected") allCollected = false;
    }
    revenue += orderRevenue;
    if (o.pickupStatus === "collected" || allCollected) collected += 1;
    else notCollected += 1;
    if (o.pickupStatus === "cancelled") cancelled += 1;
    else if (o.pickupStatus === "collected") completed += 1;
    else pending += 1;
  }

  const productSummary = Array.from(productMap.entries())
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.qty - a.qty);

  return {
    scope: input.scope,
    from: input.from,
    to: input.to,
    rangeLabel: input.rangeLabel,
    ordersReceived: scoped.length,
    ordersCompleted: completed,
    ordersPending: pending,
    ordersCancelled: cancelled,
    itemsSold,
    revenue,
    collected,
    notCollected,
    orders: scoped,
    productSummary,
  };
}

export function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("en-NG", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
