import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { CashierShell } from "@/components/CashierShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/store";
import { listCashierSales, paymentLabel, type CashierSale } from "@/lib/cashier-sales";
import { downloadCashierReceiptPdf } from "@/lib/cashier-receipt-pdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BusinessDayFilter } from "@/components/BusinessDayFilter";
import { defaultFilter, matchesFilter, type BusinessDayFilter as Filter } from "@/lib/business-day";

export const Route = createFileRoute("/cashier/receipts")({
  head: () => ({
    meta: [{ title: "Cashier Receipts · CGCC Cafeteria" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <CashierShell>
      <CashierReceipts />
    </CashierShell>
  ),
});

function CashierReceipts() {
  const [sales, setSales] = useState<CashierSale[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(defaultFilter());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSales(await listCashierSales(500));
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("cashier-receipts")
      .on("postgres_changes", { event: "*", schema: "public", table: "cashier_sales" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sales.filter((x) => {
      if (!matchesFilter({ businessDay: x.business_day, archivedAt: x.archived_at }, filter)) return false;
      if (!s) return true;
      return (
        x.code.toLowerCase().includes(s) ||
        x.receipt_no.toLowerCase().includes(s) ||
        (x.customer_name ?? "").toLowerCase().includes(s)
      );
    });
  }, [sales, q, filter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold">Receipts</h1>
        <p className="text-sm text-muted-foreground">Search by code, receipt number, date, or customer.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
        </div>
        <BusinessDayFilter value={filter} onChange={setFilter} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Receipt</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Payment</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No receipts found.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono font-semibold text-primary">{s.code}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.receipt_no}</td>
                  <td className="px-3 py-2 text-xs">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{s.customer_name || "Walk-in"}</td>
                  <td className="px-3 py-2 text-xs">{paymentLabel(s.payment_method)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatNaira(s.total)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => downloadCashierReceiptPdf(s)}>
                      <Download className="mr-1 h-3 w-3" /> PDF
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
