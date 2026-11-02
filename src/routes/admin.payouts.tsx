import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Save } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchCostPrices } from "@/lib/admin-ops";
import { loadSettings, saveSettings, useSystemSettings } from "@/lib/settings";
import { formatNaira, useStore, type Order } from "@/lib/store";
import { computeReport, VENDOR_LABELS, type ReportOrder, type ReportVendor } from "@/lib/reports";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/payouts")({
  head: () => ({ meta: [...pageMeta("Vendor Payouts · CGCC Admin", "Configure payout rates and record daily payout snapshots."), { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <PayoutsPage />
      </AdminShell>
    </AdminGuard>
  ),
});

const VENDOR_TYPES: ReportVendor[] = ["food", "snacks", "coffee", "drinks"];

type SnapshotRow = {
  id: string;
  vendor_type: string;
  business_day: string;
  orders_count: number;
  items_count: number;
  gross_revenue: number;
  cost_total: number;
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
        const report = computeReport({ orders: reportOrders, scope: v, from: dayStart, to: dayEnd, rangeLabel: day });
        // Cost of goods for the scoped items in the day's orders.
        let costTotal = 0;
        for (const o of report.orders) {
          for (const it of o.items) {
            if (it.preparationStatus !== undefined && o.pickupStatus === "cancelled") continue;
            const c = costs.get(it.productId ?? "") ?? 0;
            costTotal += c * it.qty;
          }
        }
        const rate = rates[v] ?? 100;
        const payout = Math.round((report.revenue * rate) / 100);
        return { vendor: v, report, costTotal, rate, payout };
      }),
    [reportOrders, dayStart, dayEnd, day, costs, rates],
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
      toast.success("Payout rates saved");
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
        _gross_revenue: entry.report.revenue,
        _cost_total: entry.costTotal,
        _commission_percent: 100 - entry.rate,
        _payout_amount: entry.payout,
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
        <h1 className="font-display text-2xl font-bold">Vendor Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Set how much of each vendor's sales goes back to the vendor, then record daily payout
          snapshots for your records. Nothing is paid automatically — this is your calculation and history.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Payout rates</h2>
        <p className="mb-3 text-xs text-muted-foreground">Percentage of each vendor's sales that is paid to the vendor.</p>
        <div className="grid gap-3 sm:grid-cols-4">
          {VENDOR_TYPES.map((v) => (
            <div key={v}>
              <Label className="text-xs">{VENDOR_LABELS[v]}</Label>
              <div className="mt-1 flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={rates[v]}
                  onChange={(e) => setRates({ ...rates, [v]: Number(e.target.value) })}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
        <Button className="mt-3" onClick={() => void saveRates()} disabled={savingRates}>
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
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Vendor</th>
                <th className="px-3 py-2 text-right">Orders</th>
                <th className="px-3 py-2 text-right">Items</th>
                <th className="px-3 py-2 text-right">Sales</th>
                <th className="px-3 py-2 text-right">Goods cost</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Payout</th>
                <th className="px-3 py-2 text-right">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {perVendor.map((p) => (
                <tr key={p.vendor} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{VENDOR_LABELS[p.vendor]}</td>
                  <td className="px-3 py-2 text-right">{p.report.ordersReceived}</td>
                  <td className="px-3 py-2 text-right">{p.report.itemsSold}</td>
                  <td className="px-3 py-2 text-right">{formatNaira(p.report.revenue)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{formatNaira(p.costTotal)}</td>
                  <td className="px-3 py-2 text-right">{p.rate}%</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatNaira(p.payout)}</td>
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
                  <th className="px-3 py-2 text-right">Rate</th>
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
                    <td className="px-3 py-2 text-right">{Number(s.commission_percent) ? `${100 - Number(s.commission_percent)}%` : "100%"}</td>
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
