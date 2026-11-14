import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, FileSpreadsheet, FileText, Lock, Power, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { actions, formatNaira, useStore, type Order, type OrderStatus } from "@/lib/store";
import { ReportDialog } from "@/components/ReportDialog";
import {
  collectVendorScopes,
  computeReport,
  getReportScopeLabel,
  rangeFor,
  type DateRangeKey,
  type ReportOrder,
  type ReportScope,
  type VendorScopeMeta,
} from "@/lib/reports";
import { downloadReportPdf } from "@/lib/report-pdf";
import { downloadReportXlsx } from "@/lib/report-xlsx";
import { listCategories, type CategoryRow } from "@/lib/admin-ops";
import { supabase } from "@/integrations/supabase/client";
import { BusinessDayFilter } from "@/components/BusinessDayFilter";
import {
  closeBusinessDay,
  currentBusinessDay,
  defaultFilter,
  matchesFilter,
  type BusinessDayFilter as Filter,
} from "@/lib/business-day";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      ...pageMeta("Dashboard · CGCC Admin", "Review CGCC cafeteria orders and operations."),
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <Dashboard />
      </AdminShell>
    </AdminGuard>
  ),
});

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  confirmed: "bg-indigo-100 text-indigo-900 border-indigo-300",
  preparing: "bg-blue-100 text-blue-900 border-blue-300",
  ready: "bg-emerald-100 text-emerald-900 border-emerald-300",
  collected: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-100 text-red-900 border-red-300",
};

function Dashboard() {
  const orders = useStore((s) => s.orders);
  const orderingOpen = useStore((s) => s.orderingOpen);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(defaultFilter());
  const [closing, setClosing] = useState(false);

  // Organized Inkspex-style Sales Analysis & Export state
  const [selectedScope, setSelectedScope] = useState<ReportScope>("all");
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("today");
  const todayStr = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [vendors, setVendors] = useState<VendorScopeMeta[]>([]);
  const [productCatMap, setProductCatMap] = useState<Map<string, string | null>>(new Map());
  const [productVendors, setProductVendors] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [cats, itemsRes, vendorsRes] = await Promise.all([
          listCategories(false),
          supabase.from("menu_items").select("id, category_id, vendor_type"),
          supabase.from("vendors").select("vendor_type, display_label, active").order("created_at"),
        ]);
        setCategories(cats);
        const rows = (itemsRes.data ?? []) as {
          id: string;
          category_id: string | null;
          vendor_type: string | null;
        }[];
        setProductCatMap(new Map(rows.map((r) => [r.id, r.category_id])));
        setProductVendors(rows.map((r) => r.vendor_type).filter((x): x is string => Boolean(x)));
        setVendors((vendorsRes.data ?? []) as VendorScopeMeta[]);
      } catch (e) {
        console.warn("[admin] failed to load metadata for reports", e);
      }
    })();
  }, []);

  const scoped = useMemo(
    () => orders.filter((o) => matchesFilter(o, filter)),
    [orders, filter],
  );

  const reportOrders = useMemo<ReportOrder[]>(
    () =>
      scoped.map((o: Order) => ({
        code: o.code,
        receiptNo: o.receiptNo,
        customerName: o.customerName,
        phone: o.phone,
        createdAt: o.createdAt,
        pickupTime: o.pickupTime,
        paymentStatus: o.paymentStatus,
        pickupStatus: o.pickupStatus,
        items: o.items.map((it) => ({
          productId: it.id,
          name: it.name,
          qty: it.qty,
          price: it.price,
          vendorType: it.vendorType,
          categoryId: productCatMap.get(it.id) ?? null,
          preparationStatus: it.preparationStatus,
        })),
      })),
    [scoped, productCatMap],
  );

  const vendorScopes = useMemo(
    () =>
      collectVendorScopes({
        vendors,
        extraKeys: [
          ...productVendors,
          ...orders.flatMap((o) => o.items.map((i) => i.vendorType)),
        ],
      }),
    [vendors, productVendors, orders],
  );

  const activeScopeLabel = useMemo(
    () => getReportScopeLabel(selectedScope, categories, undefined, vendors),
    [selectedScope, categories, vendors],
  );

  const activeReport = useMemo(() => {
    const custom =
      rangeKey === "custom"
        ? {
            from: new Date(fromDate + "T00:00:00").getTime(),
            to: new Date(toDate + "T00:00:00").getTime() + 24 * 3600 * 1000,
          }
        : undefined;
    const r = rangeFor(rangeKey, custom);
    return computeReport({
      orders: reportOrders,
      scope: selectedScope,
      scopeLabel: activeScopeLabel,
      from: r.from,
      to: r.to,
      rangeLabel: r.label,
      productCategoryMap: productCatMap,
    });
  }, [reportOrders, selectedScope, activeScopeLabel, rangeKey, fromDate, toDate, productCatMap]);

  async function handleQuickExcel() {
    setExportingXlsx(true);
    try {
      await downloadReportXlsx(activeReport);
      toast.success(`Exported ${activeScopeLabel} Excel report`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Excel export failed");
    } finally {
      setExportingXlsx(false);
    }
  }

  function handleQuickPdf() {
    try {
      downloadReportPdf(activeReport);
      toast.success(`Exported ${activeScopeLabel} PDF report`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    }
  }

  const counts = {
    pending: scoped.filter((o) => o.paymentStatus === "unpaid").length,
    confirmed: scoped.filter((o) => o.pickupStatus === "confirmed").length,
    preparing: scoped.filter((o) => o.pickupStatus === "preparing").length,
    ready: scoped.filter((o) => o.pickupStatus === "ready").length,
    collected: scoped.filter((o) => o.pickupStatus === "collected").length,
  };
  const revenue = scoped
    .filter((o) => o.paymentStatus === "paid" && o.pickupStatus !== "cancelled")
    .reduce((s, o) => s + o.total, 0);

  const filtered = scoped.filter((o) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      o.code.toLowerCase().includes(s) ||
      o.customerName.toLowerCase().includes(s) ||
      o.phone.toLowerCase().includes(s) ||
      (o.paymentReference ?? "").toLowerCase().includes(s)
    );
  });

  async function handleCloseDay() {
    if (closing) return;
    const day = currentBusinessDay();
    const openOrders = scoped.filter(
      (o) => o.paymentStatus === "unpaid" || o.pickupStatus !== "collected",
    ).length;
    const msg = openOrders
      ? `Close business day ${day}? ${openOrders} order(s) are still open — they will be archived.`
      : `Close business day ${day}? Today's orders will be archived.`;
    if (!window.confirm(msg)) return;
    setClosing(true);
    try {
      const res = await closeBusinessDay();
      toast.success(`Closed ${res.business_day}: ${res.orders_archived} online order(s) archived.`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to close business day");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Operations, live orders, and sales reporting.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BusinessDayFilter value={filter} onChange={setFilter} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleCloseDay()}
            disabled={closing}
          >
            <Lock className="mr-1 h-3.5 w-3.5" />
            {closing ? "Closing…" : "Close Business Day"}
          </Button>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5 shadow-soft">
            <Power className={"h-4 w-4 " + (orderingOpen ? "text-emerald-600" : "text-destructive")} />
            <span className="text-sm font-medium whitespace-nowrap">
              Ordering {orderingOpen ? "Open" : "Closed"}
            </span>
            <Switch
              checked={orderingOpen}
              onCheckedChange={(v) => actions.setOrderingOpen(Boolean(v))}
            />
          </div>
        </div>
      </div>

      {/* Operations KPI Strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="Pending Payment" value={counts.pending} tint="bg-amber-50" />
        <StatCard label="Confirmed" value={counts.confirmed} tint="bg-indigo-50" />
        <StatCard label="Preparing" value={counts.preparing} tint="bg-blue-50" />
        <StatCard label="Ready" value={counts.ready} tint="bg-emerald-50" />
        <StatCard label="Collected" value={counts.collected} tint="bg-muted" />
        <div className="col-span-2 rounded-2xl bg-primary p-4 text-primary-foreground shadow-soft md:col-span-1">
          <p className="text-xs uppercase tracking-wider text-brand">Paid Revenue</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">{formatNaira(revenue)}</p>
        </div>
      </div>

      {/* Organized Inkspex-Style Sales Analysis & Export Bar */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Sales Analysis &amp; Exports</h2>
            <p className="text-xs text-muted-foreground">
              Select Overall, any Vendor section, or any Category to inspect paid sales and export a 10-column Excel sheet or PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              View Report
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleQuickExcel()} disabled={exportingXlsx}>
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
              {exportingXlsx ? "Exporting…" : "Export Excel"}
            </Button>
            <Button size="sm" onClick={handleQuickPdf}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="report-scope" className="mb-1 block text-xs font-medium text-muted-foreground">
              Vendor / Category Scope
            </label>
            <select
              id="report-scope"
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value as ReportScope)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Overall Sales (All Vendors &amp; Categories)</option>
              <optgroup label="Vendors">
                {vendorScopes.map((v) => (
                  <option key={v} value={v}>
                    {getReportScopeLabel(v, categories, undefined, vendors)}
                  </option>
                ))}
              </optgroup>
              {categories.length > 0 && (
                <optgroup label="Categories">
                  {categories.map((cat) => (
                    <option key={cat.id} value={`cat:${cat.id}`}>
                      {cat.name} Category
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label htmlFor="report-range" className="mb-1 block text-xs font-medium text-muted-foreground">
              Period
            </label>
            <select
              id="report-range"
              value={rangeKey}
              onChange={(e) => setRangeKey(e.target.value as DateRangeKey)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week (7 days)</option>
              <option value="custom">Custom Dates</option>
            </select>
          </div>

          {rangeKey === "custom" ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="report-from" className="mb-1 block text-xs font-medium text-muted-foreground">
                  From
                </label>
                <Input
                  id="report-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label htmlFor="report-to" className="mb-1 block text-xs font-medium text-muted-foreground">
                  To
                </label>
                <Input
                  id="report-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-end rounded-lg border border-border bg-muted/30 px-3 py-1.5">
              <span className="text-[11px] text-muted-foreground">Active Filter</span>
              <span className="truncate text-sm font-semibold">{activeScopeLabel}</span>
            </div>
          )}
        </div>

        {/* Concise 4-metric KPI strip for selected scope */}
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-background px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Paid Orders</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">{activeReport.ordersReceived}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {activeReport.ordersUnpaid} unpaid · {activeReport.ordersCancelled} cancelled
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Items Sold</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">{activeReport.itemsSold}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {activeReport.collected} collected · {activeReport.notCollected} pending
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Selling Total</p>
            <p className="mt-1 font-display text-xl font-bold text-primary tabular-nums">
              {formatNaira(activeReport.revenue)}
            </p>
            <p className="text-[11px] text-muted-foreground">Paid orders only</p>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Top Item</p>
            <p className="mt-1 truncate font-display text-base font-bold">
              {activeReport.productSummary[0]?.name ?? "No sales yet"}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {activeReport.productSummary[0]
                ? `${activeReport.productSummary[0].qty} sold · ${formatNaira(activeReport.productSummary[0].revenue)}`
                : "In selected range"}
            </p>
          </div>
        </div>
      </section>

      {/* Live Orders Panel */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-4 flex items-center gap-2 border-b border-border pb-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            className="border-0 shadow-none focus-visible:ring-0"
            placeholder="Search by order code, customer name, phone, or transaction ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No orders yet. Once customers place orders, they&apos;ll appear here.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map((o) => (
              <div
                key={o.code}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-primary tabular-nums">{o.code}</p>
                    <p className="text-sm font-semibold">{o.customerName}</p>
                    <p className="text-xs text-muted-foreground">{o.phone}</p>
                  </div>
                  <span
                    className={
                      "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase " +
                      STATUS_COLORS[o.pickupStatus]
                    }
                  >
                    {o.pickupStatus}
                  </span>
                </div>

                <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                  {o.items.slice(0, 4).map((i) => (
                    <li key={i.id}>
                      {i.qty}× {i.name}
                    </li>
                  ))}
                  {o.items.length > 4 && <li>+ {o.items.length - 4} more</li>}
                </ul>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-primary tabular-nums">{formatNaira(o.total)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString()} · {o.orderType}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-muted-foreground tabular-nums">
                  <span>Receipt: {o.receiptNo}</span>
                  {o.pickupTime && <span>· Pickup: {o.pickupTime}</span>}
                  {o.paymentReference && <span>· Txn: {o.paymentReference}</span>}
                </div>

                <div className="mt-2">
                  <span
                    className={
                      "inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase " +
                      (o.paymentStatus === "paid"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-amber-100 text-amber-900 border-amber-300")
                    }
                  >
                    Payment: {o.paymentStatus}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant={o.paymentStatus === "paid" ? "outline" : "default"}
                    disabled={o.paymentStatus === "paid"}
                    onClick={() => actions.confirmPayment(o.code)}
                  >
                    Confirm Payment
                  </Button>
                  <Button
                    size="sm"
                    variant={o.pickupStatus === "preparing" ? "default" : "outline"}
                    onClick={() => actions.updateOrderStatus(o.code, "preparing")}
                  >
                    Preparing
                  </Button>
                  <Button
                    size="sm"
                    variant={o.pickupStatus === "ready" ? "default" : "outline"}
                    onClick={() => actions.updateOrderStatus(o.code, "ready")}
                  >
                    Ready
                  </Button>
                  <Button
                    size="sm"
                    variant={o.pickupStatus === "collected" ? "default" : "outline"}
                    onClick={() => actions.updateOrderStatus(o.code, "collected")}
                  >
                    Collected
                  </Button>
                  {o.pickupStatus !== "cancelled" && o.pickupStatus !== "collected" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => {
                        if (window.confirm(`Cancel order ${o.code}? This cannot be undone.`)) {
                          void actions.updateOrderStatus(o.code, "cancelled");
                        }
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReportDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        scope={selectedScope}
        scopeLabel={activeScopeLabel}
        orders={reportOrders}
      />
    </div>
  );
}

function StatCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className={"rounded-2xl border border-border p-4 shadow-soft " + tint}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
