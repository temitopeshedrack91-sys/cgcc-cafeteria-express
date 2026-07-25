import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { InventoryPanel } from "@/components/InventoryPanel";
import { Button } from "@/components/ui/button";
import { fetchInventoryHistory, type InventoryHistoryRow } from "@/lib/inventory";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({
    meta: [{ title: "Inventory · CGCC Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <AdminInventory />
      </AdminShell>
    </AdminGuard>
  ),
});

function AdminInventory() {
  const [history, setHistory] = useState<InventoryHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      setHistory(await fetchInventoryHistory(null, 200));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    const ch = supabase
      .channel("admin-inventory-history")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inventory_history" }, () =>
        void loadHistory(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [loadHistory]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Override stock, adjust thresholds, and review every change across all vendors.
        </p>
      </div>

      <InventoryPanel scope={null} allowThreshold title="All Products" />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Inventory History</h2>
            <p className="text-xs text-muted-foreground">Last 200 stock changes across every source.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadHistory()} disabled={loading}>
            <RefreshCw className={"mr-1 h-4 w-4 " + (loading ? "animate-spin" : "")} /> Refresh
          </Button>
        </div>
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">Date · Day · Time</th>
                <th className="p-2">Product</th>
                <th className="p-2">Vendor</th>
                <th className="p-2 text-right">Previous</th>
                <th className="p-2 text-right">New</th>
                <th className="p-2 text-right">Δ</th>
                <th className="p-2">Source</th>
                <th className="p-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    No stock changes yet.
                  </td>
                </tr>
              ) : (
                history.map((h) => {
                  const d = new Date(h.created_at);
                  return (
                    <tr key={h.id} className="border-t border-border">
                      <td className="p-2">
                        {d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })} ·{" "}
                        {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-2 font-semibold">{h.item_name}</td>
                      <td className="p-2">{h.vendor_type ?? "—"}</td>
                      <td className="p-2 text-right">{h.previous_qty}</td>
                      <td className="p-2 text-right font-semibold">{h.new_qty}</td>
                      <td
                        className={
                          "p-2 text-right font-bold " +
                          (h.delta > 0 ? "text-emerald-700" : h.delta < 0 ? "text-destructive" : "")
                        }
                      >
                        {h.delta > 0 ? "+" + h.delta : h.delta}
                      </td>
                      <td className="p-2 uppercase text-[10px]">{h.source.replace("_", " ")}</td>
                      <td className="p-2">{h.reason ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
