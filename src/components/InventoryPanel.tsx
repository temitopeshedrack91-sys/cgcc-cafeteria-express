import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Minus, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  adjustStockSplitRpc,
  fetchInventory,
  setAvailable,
  setLowStockThreshold,
  type InventoryRow,
} from "@/lib/inventory";
import { formatNaira } from "@/lib/store";
import { toast } from "sonner";
import {
  canChangeStock,
  FULL_STOCK_PERMISSIONS,
  type StockPermissions,
} from "@/lib/vendor-permissions";

type Props = {
  scope?: string | null;
  allowThreshold?: boolean;
  title?: string;
  stockPermissions?: StockPermissions;
};

/**
 * Whole-number quantity field vendors can type into directly (e.g. 150)
 * instead of clicking + repeatedly. Commits on blur or Enter.
 */
function QtyField({
  value,
  onCommit,
  ariaLabel,
  disabled = false,
}: {
  value: number;
  onCommit: (next: number) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  function commit() {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(String(value));
      toast.error("Enter a whole number of 0 or more");
      return;
    }
    if (n === value) {
      setDraft(String(value));
      return;
    }
    onCommit(Math.floor(n));
  }

  return (
    <Input
      aria-label={ariaLabel}
      disabled={disabled}
      className="mx-auto h-8 w-16 text-center font-semibold tabular-nums"
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      value={draft}
      onFocus={(e) => {
        setEditing(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(String(value));
          setEditing(false);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function InventoryPanel({
  scope,
  allowThreshold = false,
  title = "Inventory Management",
  stockPermissions = FULL_STOCK_PERMISSIONS,
}: Props) {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

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
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => void load())
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
    () =>
      rows.filter(
        (r) =>
          r.available &&
          r.stock_online > 0 &&
          r.stock_online <= r.low_stock_threshold,
      ).length,
    [rows],
  );
  const soldOutCount = useMemo(
    () => rows.filter((r) => !r.available || r.stock_online === 0).length,
    [rows],
  );

  async function commitOnline(item: InventoryRow, nextOnline: number) {
    const cleanOnline = Math.max(0, nextOnline);
    if (
      !canChangeStock(
        { online: item.stock_online, walkin: item.stock_walkin },
        { online: cleanOnline, walkin: item.stock_walkin },
        stockPermissions,
      )
    ) {
      toast.error("You do not have permission for this stock change");
      return;
    }
    const prev = rows;
    setRows((rs) =>
      rs.map((r) =>
        r.id === item.id
          ? {
              ...r,
              stock_online: cleanOnline,
              stock_qty: cleanOnline + item.stock_walkin,
            }
          : r,
      ),
    );
    try {
      await adjustStockSplitRpc(item.id, cleanOnline, item.stock_walkin);
    } catch (e: any) {
      toast.error(e.message ?? "Stock update failed");
      setRows(prev);
    }
  }

  async function bumpOnline(item: InventoryRow, delta: number) {
    await commitOnline(item, Math.max(0, item.stock_online + delta));
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
    setRows((rs) =>
      rs.map((r) => (r.id === item.id ? { ...r, low_stock_threshold: value } : r)),
    );
    try {
      await setLowStockThreshold(item.id, value);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
      setRows(prev);
    }
  }

  function statusChip(r: InventoryRow) {
    const soldOut = !r.available || r.stock_online === 0;
    if (soldOut) {
      return (
        <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
          Sold Out
        </span>
      );
    }
    if (r.stock_online <= r.low_stock_threshold) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
          <AlertTriangle className="h-3 w-3" /> Low
        </span>
      );
    }
    return (
      <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
        In Stock
      </span>
    );
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
            Online pre-order stock · {rows.length} products · {lowCount} low stock · {soldOutCount} sold out
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

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-center">Online Stock</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Available</th>
              {allowThreshold && <th className="px-3 py-2 text-center">Low @</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={allowThreshold ? 6 : 5}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {r.vendor_type ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNaira(r.price)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!stockPermissions.reduce || r.stock_online === 0}
                        aria-label={`Reduce online stock for ${r.name}`}
                        className="h-7 w-7"
                        onClick={() => void bumpOnline(r, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <QtyField
                        value={r.stock_online}
                        disabled={!stockPermissions.increase && !stockPermissions.reduce}
                        ariaLabel={`Online quantity for ${r.name}`}
                        onCommit={(v) => void commitOnline(r, v)}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!stockPermissions.increase}
                        aria-label={`Increase online stock for ${r.name}`}
                        className="h-7 w-7"
                        onClick={() => void bumpOnline(r, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">{statusChip(r)}</td>
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={r.available}
                      onCheckedChange={(v) => void toggleAvail(r, Boolean(v))}
                    />
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
