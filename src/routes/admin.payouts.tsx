import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, RotateCcw, Save } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchCostPrices, listCategories, listProducts, type CategoryRow } from "@/lib/admin-ops";
import { saveSettings, useSystemSettings } from "@/lib/settings";
import { formatNaira, useStore, type Order } from "@/lib/store";
import {
  collectVendorScopes,
  computeReport,
  getReportScopeLabel,
  type ReportOrder,
  type VendorScopeMeta,
} from "@/lib/reports";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/payouts")({
  head: () => ({
    meta: [
      ...pageMeta("Vendor Payouts · CGCC Admin", "Configure payout rates and record daily payout snapshots."),
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <PayoutsPage />
      </AdminShell>
    </AdminGuard>
  ),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

type SnapshotRow = {
  id: string;
  vendor_type: string;
  business_day: string;
  orders_count: number;
  items_count: number;
  gross_revenue: number;
  cost_total: number | string;
  commission_percent: string | number;
  payout_amount: number;
  updated_at: string;
};

function PayoutsPage() {
  const settings = useSystemSettings();
  const orders = useStore((s) => s.orders);
  const [rates, setRates] = useState<Record<string, number>>(settings.payoutPercents);
  const [savingRates, setSavingRates] = useState(false);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [costs, setCosts] = useState<Map<string, number>>(new Map());
  const [vendors, setVendors] = useState<VendorScopeMeta[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [productVendorKeys, setProductVendorKeys] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [recording, setRecording] = useState<string | null>(null);
  const [loadingSnaps, setLoadingSnaps] = useState(true);

  useEffect(() => {
    setRates(settings.payoutPercents);
  }, [settings]);

  useEffect(() => {
    void Promise.all([
      fetchCostPrices().catch(() => new Map<string, number>()),
      listCategories(false).catch(() => [] as CategoryRow[]),
      listProducts(true).catch(() => []),
      supabase.from("vendors").select("vendor_type, display_label, active").order("created_at"),
    ]).then(([costMap, cats, prods, vendRes]) => {
      setCosts(costMap);
      setCategories(cats);
      setProductVendorKeys(
        prods.map((p) => p.vendor_type).filter((x): x is string => Boolean(x)),
      );
      setVendors((vendRes.data ?? []) as VendorScopeMeta[]);
    });
  }, []);

  const vendorTypes = useMemo(
    () =>
      collectVendorScopes({
        vendors,
        extraKeys: [
          ...productVendorKeys,
          ...orders.flatMap((o) => o.items.map((i) => i.vendorType)),
          ...snapshots.map((s) => s.vendor_type),
        ],
      }),
    [vendors, productVendorKeys, orders, snapshots],
  );

  const loadSnapshots = useCallback(async () => {
    setLoadingSnaps(true);
    try {
      const { data, error } = await supabase
        .from("payout_snapshots")
        .select("*")
        .order("business_day", { ascending: false })
        .limit(60);
      if (error) throw error;
      setSnapshots((data ?? []) as SnapshotRow[]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load payout history");
    } finally {
      setLoadingSnaps(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const reportOrders = useMemo<ReportOrder[]>(
    () =>
      orders.map((o: Order) => ({
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
          preparationStatus: it.preparationStatus,
        })),
      })),
    [orders],
  );

  const dayStart = new Date(day + "T00:00:00").getTime();
  const dayEnd = dayStart + 24 * 3600 * 1000;

  const perVendor = useMemo(
    () =>
      vendorTypes.map((v) => {
        const label = getReportScopeLabel(v, categories, undefined, vendors);
        const report = computeReport({
          orders: reportOrders,
          scope: v,
          scopeLabel: label,
          from: dayStart,
          to: dayEnd,
          rangeLabel: day,
        });
        const rate = rates[v] ?? settings.defaultVendorPayoutPercent ?? 85;
        let costTotal = 0;
        let activeRevenue = 0;
        for (const o of report.orders) {
          if (o.pickupStatus === "cancelled") continue;
          for (const it of o.items) {
            const c = costs.get(it.productId ?? "");
            const unitCost = c !== undefined && c > 0 ? c : round2((it.price * rate) / 100);
            costTotal += unitCost * it.qty;
            activeRevenue += it.price * it.qty;
          }
        }
        costTotal = round2(costTotal);
        const gross = activeRevenue || report.revenue;
        const payout = round2((gross * rate) / 100);
        const churchCharge = round2(gross - payout);
        return {
          vendor: v,
          label,
          report,
          gross,
          costTotal,
          rate,
          chargePercent: round2(100 - rate),
          churchCharge,
          payout,
        };
      }),
    [vendorTypes, categories, vendors, reportOrders, dayStart, dayEnd, day, costs, rates, settings.defaultVendorPayoutPercent],
  );

  async function saveRates() {
    for (const v of vendorTypes) {
      const value = Number(rates[v] ?? settings.defaultVendorPayoutPercent ?? 85);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        toast.error("Payout rates must be between 0 and 100");
        return;
      }
    }
    setSavingRates(true);
    try {
      await saveSettings({ ...settings, payoutPercents: { ...rates } });
      toast.success("Vendor payout & CGCC service charge rates saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingRates(false);
    }
  }

  async function record(vendor: string) {
    const entry = perVendor.find((p) => p.vendor === vendor);
    if (!entry) return;
    setRecording(vendor);
    try {
      const { error } = await supabase.rpc("save_payout_snapshot", {
        _vendor_type: vendor,
        _business_day: day,
        _orders_count: entry.report.ordersReceived,
        _items_count: entry.report.itemsSold,
        _gross_revenue: Math.round(entry.gross),
        _cost_total: Math.round(entry.costTotal),
        _commission_percent: entry.chargePercent,
        _payout_amount: Math.round(entry.payout),
      });
      if (error) throw error;
      toast.success(`${entry.label} snapshot saved for ${day}`);
      await loadSnapshots();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save snapshot");
    } finally {
      setRecording(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Vendor Payouts &amp; Service Charge</h1>
        <p className="text-sm text-muted-foreground">
          Configure how much of each vendor&apos;s sales goes to the vendor (default 85%) vs CGCC service charge (default 15%), then record daily reconciliation snapshots.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold">Payout &amp; Service Charge Rates</h2>
            <p className="text-xs text-muted-foreground">
              Vendor receives the payout % below; CGCC retains the remaining service charge %.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setRates(Object.fromEntries(vendorTypes.map((v) => [v, 85])))
            }
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Preset All 85% / 15%
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {vendorTypes.map((v) => {
            const vendorRate = Number(rates[v] ?? settings.defaultVendorPayoutPercent ?? 85);
            const churchRate = Math.max(0, round2(100 - vendorRate));
            const title = getReportScopeLabel(v, categories, undefined, vendors);
            return (
              <div key={v} className="rounded-xl border border-border bg-muted/30 p-3">
                <Label className="block truncate text-xs font-semibold">{title}</Label>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={vendorRate}
                    onChange={(e) => setRates({ ...rates, [v]: Number(e.target.value) })}
                    className="h-9 w-24 bg-background tabular-nums"
                  />
                  <span className="text-xs font-medium text-muted-foreground">% to vendor</span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                  CGCC service charge: <span className="font-semibold text-foreground">{churchRate}%</span>
                </p>
              </div>
            );
          })}
        </div>

        <Button className="mt-4" onClick={() => void saveRates()} disabled={savingRates}>
          {savingRates ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save rates
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <div>
            <Label className="text-xs">Business day</Label>
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 w-44" />
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm tabular-nums">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Vendor</th>
                <th className="px-3 py-2 text-right">Orders</th>
                <th className="px-3 py-2 text-right">Items</th>
                <th className="px-3 py-2 text-right">Selling Total</th>
                <th className="px-3 py-2 text-right">Cost Sub Total</th>
                <th className="px-3 py-2 text-right">CGCC Charge</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Vendor Payout</th>
                <th className="px-3 py-2 text-right">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {perVendor.map((p) => (
                <tr key={p.vendor} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{p.label}</td>
                  <td className="px-3 py-2 text-right">{p.report.ordersReceived}</td>
                  <td className="px-3 py-2 text-right">{p.report.itemsSold}</td>
                  <td className="px-3 py-2 text-right">{formatNaira(p.gross)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{formatNaira(p.costTotal)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatNaira(p.churchCharge)} ({p.chargePercent}%)
                  </td>
                  <td className="px-3 py-2 text-right">{p.rate}%</td>
                  <td className="px-3 py-2 text-right font-semibold text-primary">{formatNaira(p.payout)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => void record(p.vendor)} disabled={recording !== null}>
                      {recording === p.vendor ? <Loader2 className="h-3 w-3 animate-spin" /> : "Record"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Snapshot history</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Saved payouts keep the rate that was used that day. Recording again for the same vendor and day updates the row.
        </p>
        {loadingSnaps ? (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : snapshots.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No snapshots recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm tabular-nums">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Day</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-right">Orders</th>
                  <th className="px-3 py-2 text-right">Sales</th>
                  <th className="px-3 py-2 text-right">Vendor Rate</th>
                  <th className="px-3 py-2 text-right">CGCC Charge</th>
                  <th className="px-3 py-2 text-right">Payout</th>
                  <th className="px-3 py-2 text-right">Saved</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2">{s.business_day}</td>
                    <td className="px-3 py-2">
                      {getReportScopeLabel(s.vendor_type, categories, undefined, vendors)}
                    </td>
                    <td className="px-3 py-2 text-right">{s.orders_count}</td>
                    <td className="px-3 py-2 text-right">{formatNaira(s.gross_revenue)}</td>
                    <td className="px-3 py-2 text-right">{`${100 - Number(s.commission_percent)}%`}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{`${Number(s.commission_percent)}%`}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatNaira(s.payout_amount)}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {new Date(s.updated_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
