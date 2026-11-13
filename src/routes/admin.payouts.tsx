import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, RotateCcw, Save } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchCostPrices } from "@/lib/admin-ops";
import { saveSettings, useSystemSettings } from "@/lib/settings";
import { formatNaira, useStore, type Order } from "@/lib/store";
import { computeReport, VENDOR_LABELS, type ReportOrder, type ReportVendor } from "@/lib/reports";
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

const VENDOR_TYPES: ReportVendor[] = ["food", "snacks", "coffee", "drinks"];
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
  const [rates, setRates] = useState(settings.payoutPercents);
  const [savingRates, setSavingRates] = useState(false);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [costs, setCosts] = useState<Map<string, number>>(new Map());
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [recording, setRecording] = useState<string | null>(null);
  const [loadingSnaps, setLoadingSnaps] = useState(true);

  useEffect(() => {
    setRates(settings.payoutPercents);
  }, [settings]);

  useEffect(() => {
    void fetchCostPrices().then(setCosts).catch(() => setCosts(new Map()));
  }, []);

  const loadSnapshots = useCallback(async () => {
    setLoadingSnaps(true);
    try {
      const { data, error } = await supabase
        .from("payout_snapshots")
        .select("*")
        .order("business_day", { ascending: false })
        .limit(60);
      if (error) throw error;
      setSnapshots((data ?? []) as any);
    } catch (e: any) {
      toast.error(e.message ?? "Could not load payout history");
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
      VENDOR_TYPES.map((v) => {
        const report = computeReport({
          orders: reportOrders,
          scope: v,
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
          report,
          gross,
          costTotal,
          rate,
          chargePercent: round2(100 - rate),
          churchCharge,
          payout,
        };
      }),
    [reportOrders, dayStart, dayEnd, day, costs, rates, settings.defaultVendorPayoutPercent],
  );

  async function saveRates() {
    for (const v of VENDOR_TYPES) {
      const value = Number(rates[v]);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        toast.error("Payout rates must be between 0 and 100");
        return;
      }
    }
    setSavingRates(true);
    try {
      await saveSettings({ ...settings, payoutPercents: { ...rates } });
      toast.success("Vendor payout & CGCC service charge rates saved");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSavingRates(false);
    }
  }

  async function record(vendor: ReportVendor) {
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
      toast.success(`${VENDOR_LABELS[vendor]} snapshot saved for ${day}`);
      await loadSnapshots();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save snapshot");
    } finally {
      setRecording(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Vendor Payouts & Service Charge</h1>
        <p className="text-sm text-muted-foreground">
          Configure how much of each vendor&apos;s sales goes to the vendor (default 85%) vs CGCC service charge (default 15%), then record daily reconciliation snapshots.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold">Payout & Service Charge Rates</h2>
            <p className="text-xs text-muted-foreground">
              Vendor receives the payout % below; CGCC retains the remaining service charge %.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRates({ food: 85, snacks: 85, coffee: 85, drinks: 85 })}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Preset 85% / 15%
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {VENDOR_TYPES.map((v) => {
            const vendorRate = Number(rates[v] ?? 85);
            const churchRate = Math.max(0, round2(100 - vendorRate));
            return (
              <div key={v} className="rounded-xl border border-border bg-muted/30 p-3">
                <Label className="text-xs font-semibold">{VENDOR_LABELS[v]}</Label>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={rates[v]}
                    onChange={(e) => setRates({ ...rates, [v]: Number(e.target.value) })}
                    className="h-9 w-24 bg-background"
                  />
                  <span className="text-xs font-medium text-muted-foreground">% to vendor</span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
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
          <table className="w-full min-w-[800px] text-sm">
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
                  <td className="px-3 py-2 font-semibold">{VENDOR_LABELS[p.vendor]}</td>
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
            <table className="w-full min-w-[760px] text-sm">
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
                    <td className="px-3 py-2">{VENDOR_LABELS[s.vendor_type as ReportVendor] ?? s.vendor_type}</td>
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
