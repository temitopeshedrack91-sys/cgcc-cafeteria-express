import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Minus, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  adjustStockSplitRpc,
  fetchInventory,
  reallocateStockRpc,
  setAvailable,
  setLowStockThreshold,
  type InventoryRow,
} from "@/lib/inventory";
import { formatNaira } from "@/lib/store";
import { toast } from "sonner";

type Props = { scope?: string | null; allowThreshold?: boolean; title?: string };

/**
 * Whole-number quantity field vendors can type into directly (e.g. 150)
 * instead of clicking + repeatedly. Commits on blur or Enter.
 */
function QtyField({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number;
  onCommit: (next: number) => void;
  ariaLabel: string;
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

export function InventoryPanel({ scope, allowThreshold = false, title = "Inventory Management" }: Props) {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [moveFor, setMoveFor] = useState<InventoryRow | null>(null);
  const [moveQty, setMoveQty] = useState<string>("");
  const [moveDir, setMoveDir] = useState<"to_online" | "to_walkin">("to_online");

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
    () => rows.filter((r) => r.available && r.stock_qty > 0 && r.stock_qty <= r.low_stock_threshold).length,
    [rows],
  );
  const soldOutCount = useMemo(() => rows.filter((r) => !r.available || r.stock_qty === 0).length, [rows]);

  async function commitSplit(item: InventoryRow, online: number, walkin: number) {
    const prev = rows;
    setRows((rs) =>
      rs.map((r) =>
        r.id === item.id
          ? { ...r, stock_online: online, stock_walkin: walkin, stock_qty: online + walkin }
          : r,
      ),
    );
    try {
      await adjustStockSplitRpc(item.id, Math.max(0, online), Math.max(0, walkin));
    } catch (e: any) {
      toast.error(e.message ?? "Stock update failed");
      setRows(prev);
    }
  }

  async function bumpOnline(item: InventoryRow, delta: number) {
    await commitSplit(item, Math.max(0, item.stock_online + delta), item.stock_walkin);
  }
  async function bumpWalkin(item: InventoryRow, delta: number) {
    await commitSplit(item, item.stock_online, Math.max(0, item.stock_walkin + delta));
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

  async function submitMove() {
    if (!moveFor) return;
    const n = parseInt(moveQty, 10);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a positive number");
      return;
    }
    const delta = moveDir === "to_online" ? n : -n;
    try {
      await reallocateStockRpc(moveFor.id, delta);
      toast.success("Stock reallocated");
      setMoveFor(null);
      setMoveQty("");
      void load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reallocate");
    }
  }

  function statusChip(r: InventoryRow) {
    const soldOut = !r.available || r.stock_qty === 0;
    if (soldOut)
      return (
        <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
          Sold Out
        </span>
      );
    const chips: React.ReactNode[] = [];
    if (r.stock_online === 0)
      chips.push(
        <span key="oo" className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
          Out of Online
        </span>,
      );
    if (r.stock_walkin === 0)
      chips.push(
        <span key="ow" className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
          Out of Walk-in
        </span>,
      );
    if (chips.length === 0) {
      const low = r.stock_qty <= r.low_stock_threshold;
      if (low)
        chips.push(
          <span key="low" className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
            <AlertTriangle className="h-3 w-3" /> Low
          </span>,
        );
      else
        chips.push(
          <span key="ok" className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
            In Stock
          </span>,
        );
    }
    return <div className="flex flex-wrap justify-center gap-1">{chips}</div>;
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
          <Input className="h-9 w-52" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-center">Total</th>
              <th className="px-3 py-2 text-center">Online</th>
              <th className="px-3 py-2 text-center">Walk-in</th>
              <th className="px-3 py-2 text-center">Move</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Available</th>
              {allowThreshold && <th className="px-3 py-2 text-center">Low @</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={allowThreshold ? 9 : 8} className="px-3 py-8 text-center text-muted-foreground">
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{r.vendor_type ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNaira(r.price)}</td>
                  <td className="px-3 py-2">
                    <QtyField
                      value={r.stock_qty}
                      ariaLabel={`Total quantity for ${r.name}`}
                      onCommit={(total) => {
                        // Online-first: extra stock goes to Online; reductions come off Online first.
                        const walkin = Math.min(r.stock_walkin, total);
                        void commitSplit(r, total - walkin, walkin);
                      }}
                    />
                  </td>


                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => void bumpOnline(r, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <QtyField
                        value={r.stock_online}
                        ariaLabel={`Online quantity for ${r.name}`}
                        onCommit={(v) => void commitSplit(r, v, r.stock_walkin)}
                      />
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => void bumpOnline(r, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => void bumpWalkin(r, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <QtyField
                        value={r.stock_walkin}
                        ariaLabel={`Walk-in quantity for ${r.name}`}
                        onCommit={(v) => void commitSplit(r, r.stock_online, v)}
                      />
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => void bumpWalkin(r, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>

                  <td className="px-3 py-2 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-[11px]"
                      onClick={() => {
                        setMoveFor(r);
                        setMoveDir("to_online");
                        setMoveQty("");
                      }}
                    >
                      <ArrowLeftRight className="h-3 w-3" /> Move
                    </Button>
                  </td>
                  <td className="px-3 py-2 text-center">{statusChip(r)}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!moveFor} onOpenChange={(o) => !o && setMoveFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reallocate stock — {moveFor?.name}</DialogTitle>
            <DialogDescription>
              Currently: Online {moveFor?.stock_online} · Walk-in {moveFor?.stock_walkin} · Total {moveFor?.stock_qty}. Total
              stays the same.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={moveDir === "to_online" ? "default" : "outline"}
                onClick={() => setMoveDir("to_online")}
              >
                Walk-in → Online
              </Button>
              <Button
                size="sm"
                variant={moveDir === "to_walkin" ? "default" : "outline"}
                onClick={() => setMoveDir("to_walkin")}
              >
                Online → Walk-in
              </Button>
            </div>
            <Input
              type="number"
              min={1}
              placeholder="Quantity to move"
              value={moveQty}
              onChange={(e) => setMoveQty(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveFor(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitMove()}>Move stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
