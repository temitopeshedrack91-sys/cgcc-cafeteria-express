import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Minus, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  adjustStockRpc,
  fetchInventory,
  setAvailable,
  setLowStockThreshold,
  type InventoryRow,
} from "@/lib/inventory";
import { formatNaira } from "@/lib/store";
import { toast } from "sonner";

type Props = { scope?: string | null; allowThreshold?: boolean; title?: string };

export function InventoryPanel({ scope, allowThreshold = false, title = "Inventory Management" }: Props) {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchInventory(scope ?? null);
      setRows(data);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load inventory");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("inventory-panel-" + (scope ?? "all"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load, scope]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(s));
  }, [rows, q]);

  const lowCount = useMemo(
    () => rows.filter((r) => r.available && r.stock_qty > 0 && r.stock_qty <= r.low_stock_threshold).length,
    [rows],
  );
  const soldOutCount = useMemo(() => rows.filter((r) => !r.available || r.stock_qty === 0).length, [rows]);

  async function commitQty(item: InventoryRow, next: number) {
    if (!Number.isFinite(next) || next < 0) return;
    if (next === item.stock_qty) return;
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === item.id ? { ...r, stock_qty: next, available: next > 0 ? r.available : false } : r)));
    try {
      await adjustStockRpc(item.id, next);
    } catch (e: any) {
      toast.error(e.message ?? "Stock update failed");
      setRows(prev);
    }
  }

  async function bump(item: InventoryRow, delta: number) {
    await commitQty(item, Math.max(0, item.stock_qty + delta));
  }

  async function toggleAvail(item: InventoryRow, next: boolean) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === item.id ? { ...r, available: next } : r)));
    try {
      await setAvailable(item.id, next);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
      setRows(prev);
    }
  }

  async function commitThreshold(item: InventoryRow, value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    if (value === item.low_stock_threshold) return;
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === item.id ? { ...r, low_stock_threshold: value } : r)));
    try {
      await setLowStockThreshold(item.id, value);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
      setRows(prev);
    }
  }

  if (loading) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
        Loading inventory…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {rows.length} products · {lowCount} low stock · {soldOutCount} sold out
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="h-9 w-52"
            placeholder="Search products"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-center">Quantity</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Available</th>
              {allowThreshold && <th className="px-3 py-2 text-center">Low @</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={allowThreshold ? 6 : 5} className="px-3 py-8 text-center text-muted-foreground">
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const draft = drafts[r.id] ?? String(r.stock_qty);
                const low = r.stock_qty > 0 && r.stock_qty <= r.low_stock_threshold;
                const soldOut = !r.available || r.stock_qty === 0;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">{r.vendor_type ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{formatNaira(r.price)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => void bump(r, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          className="h-8 w-16 text-center"
                          type="number"
                          min={0}
                          value={draft}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (Number.isFinite(v)) void commitQty(r, Math.max(0, v));
                            setDrafts((d) => {
                              const { [r.id]: _, ...rest } = d;
                              return rest;
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => void bump(r, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {soldOut ? (
                        <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
                          Sold Out
                        </span>
                      ) : low ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                          <AlertTriangle className="h-3 w-3" /> Low Stock
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch checked={r.available} onCheckedChange={(v) => void toggleAvail(r, Boolean(v))} />
                    </td>
                    {allowThreshold && (
                      <td className="px-3 py-2 text-center">
                        <Input
                          className="mx-auto h-8 w-16 text-center"
                          type="number"
                          min={0}
                          defaultValue={r.low_stock_threshold}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (Number.isFinite(v)) void commitThreshold(r, Math.max(0, v));
                          }}
                        />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
