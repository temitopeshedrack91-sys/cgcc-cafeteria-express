import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileDown, Minus, Plus, Printer, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";
import { CashierShell } from "@/components/CashierShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORIES, DEFAULT_MENU, type MenuCategory } from "@/lib/menu-data";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/store";
import {
  createCashierSale,
  listCashierSales,
  paymentLabel,
  type CashierPaymentMethod,
  type CashierSale,
} from "@/lib/cashier-sales";
import { downloadCashierReceiptPdf } from "@/lib/cashier-receipt-pdf";
import { toast } from "sonner";
import type { ReportOrder, ReportScope } from "@/lib/reports";
import { rangeFor, computeReport } from "@/lib/reports";
import { downloadReportPdf } from "@/lib/report-pdf";
import { downloadReportXlsx } from "@/lib/report-xlsx";
import { closeBusinessDay, currentBusinessDay } from "@/lib/business-day";
import { isBusinessDayClosed } from "@/lib/admin-ops";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/cashier/")({
  head: () => ({
    meta: [
      { title: "Cashier Sales · CGCC Cafeteria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <CashierShell>
      <CashierSales />
    </CashierShell>
  ),
});

type LiveItem = {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  available: boolean;
  stock_qty: number;
  stock_walkin: number;
  stock_online: number;
};

type CartLine = { id: string; name: string; price: number; qty: number };

const PAYMENT_METHODS: CashierPaymentMethod[] = ["cash", "pos", "transfer", "opay"];

function CashierSales() {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [cat, setCat] = useState<MenuCategory | "All">("All");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payMethod, setPayMethod] = useState<CashierPaymentMethod>("cash");
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<CashierSale | null>(null);
  const [sales, setSales] = useState<CashierSale[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const [closing, setClosing] = useState(false);

  const loadMenu = useCallback(async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, price, available, stock_qty")
      .order("name");
    if (error) {
      toast.error("Failed to load menu");
      return;
    }
    const catMap = new Map<string, MenuCategory>();
    for (const m of DEFAULT_MENU) catMap.set(m.id, m.category);
    setItems(
      (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        price: r.price,
        category: catMap.get(r.id) ?? "Meals",
        available: r.available !== false,
        stock_qty: r.stock_qty ?? 0,
      })),
    );
  }, []);

  const loadSales = useCallback(async () => {
    try {
      setSales(await listCashierSales(200));
    } catch (e: any) {
      console.error(e);
    }
  }, []);

  const refreshClosed = useCallback(async () => {
    setClosed(await isBusinessDayClosed());
  }, []);

  useEffect(() => {
    void loadMenu();
    void loadSales();
    void refreshClosed();
    const ch = supabase
      .channel("cashier-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => void loadMenu())
      .on("postgres_changes", { event: "*", schema: "public", table: "cashier_sales" }, () => void loadSales())
      .on("postgres_changes", { event: "*", schema: "public", table: "business_day_closures" }, () => void refreshClosed())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [loadMenu, loadSales, refreshClosed]);

  async function doCloseSales() {
    if (!confirm("Close today's sales? Cashiers will not be able to add new walk-in sales until admin reopens the day.")) return;
    setClosing(true);
    try {
      await closeBusinessDay(currentBusinessDay(), "Cashier reconciliation");
      toast.success("Sales closed for today");
      setClosed(true);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to close sales");
    } finally {
      setClosing(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (!i.available) return false;
      if (cat !== "All" && i.category !== cat) return false;
      if (s && !i.name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [items, cat, q]);

  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const totalQty = cart.reduce((s, l) => s + l.qty, 0);

  function addToCart(it: LiveItem) {
    setCart((c) => {
      const found = c.find((l) => l.id === it.id);
      if (found) return c.map((l) => (l.id === it.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { id: it.id, name: it.name, price: it.price, qty: 1 }];
    });
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) setCart((c) => c.filter((l) => l.id !== id));
    else setCart((c) => c.map((l) => (l.id === id ? { ...l, qty } : l)));
  }

  async function completeSale() {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setSubmitting(true);
    try {
      const sale = await createCashierSale({
        payment_method: payMethod,
        customer_name: customer.trim() || undefined,
        note: note.trim() || undefined,
        items: cart.map((l) => ({ id: l.id, qty: l.qty })),
      });
      toast.success(`Sale ${sale.code} completed`);
      setLastSale(sale);
      setCart([]);
      setCustomer("");
      setNote("");
      void loadMenu();
      void loadSales();
    } catch (e: any) {
      toast.error(e.message ?? "Sale failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Sales</h1>
          <p className="text-sm text-muted-foreground">Walk-in orders — inventory syncs live.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadMenu()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setReportOpen(true)}>
            <FileDown className="mr-1 h-4 w-4" /> End of Day
          </Button>
          <Button size="sm" variant={closed ? "outline" : "destructive"} disabled={closed || closing} onClick={doCloseSales}>
            <Lock className="mr-1 h-4 w-4" /> {closed ? "Sales Closed" : closing ? "Closing…" : "Close Sales"}
          </Button>
        </div>
      </div>

      {closed && (
        <div className="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900">
          <Lock className="mr-1 inline h-4 w-4" /> Today's sales are closed. New walk-in sales are blocked until an admin
          reopens the day.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search product…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="max-w-xs"
              />
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant={cat === "All" ? "default" : "outline"} onClick={() => setCat("All")}>
                  All
                </Button>
                {CATEGORIES.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={cat === c ? "default" : "outline"}
                    onClick={() => setCat(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.length === 0 ? (
              <p className="col-span-full rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                No products available.
              </p>
            ) : (
              filtered.map((i) => {
                const low = i.stock_qty > 0 && i.stock_qty <= 10;
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => addToCart(i)}
                    className="rounded-xl border border-border bg-card p-3 text-left shadow-soft transition hover:border-brand hover:shadow-elegant"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-sm font-bold leading-tight">{i.name}</p>
                      {low && (
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-900">
                          Low
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-bold text-primary">{formatNaira(i.price)}</p>
                    <p className="mt-1 text-[10px] uppercase text-muted-foreground">Stock: {i.stock_qty}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="mb-2 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <h2 className="font-display text-lg font-bold">Cart</h2>
              <span className="ml-auto text-xs text-muted-foreground">{totalQty} items</span>
            </div>
            {cart.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Tap a product to add it.
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-auto">
                {cart.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{formatNaira(l.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(l.id, l.qty - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(l.id, l.qty + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => updateQty(l.id, 0)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="font-display text-xl font-bold text-primary">{formatNaira(total)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
            <div>
              <Label className="text-xs">Customer name (optional)</Label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" />
            </div>
            <div>
              <Label className="text-xs">Payment method</Label>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {PAYMENT_METHODS.map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={payMethod === m ? "default" : "outline"}
                    onClick={() => setPayMethod(m)}
                  >
                    {paymentLabel(m)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. table 3" />
            </div>
            <Button
              className="w-full rounded-full"
              size="lg"
              disabled={submitting || cart.length === 0}
              onClick={completeSale}
            >
              {submitting ? "Completing…" : `Complete Sale · ${formatNaira(total)}`}
            </Button>
          </div>
        </aside>
      </div>

      <ReceiptDialog sale={lastSale} onClose={() => setLastSale(null)} />
      <CashierReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        sales={sales}
      />
    </div>
  );
}

function ReceiptDialog({ sale, onClose }: { sale: CashierSale | null; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Dialog open={sale !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sale Completed Successfully · {sale?.code}</DialogTitle>
        </DialogHeader>
        {sale && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receipt</span>
                <span className="font-mono">{sale.receipt_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment</span>
                <span>{paymentLabel(sale.payment_method)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-primary">{formatNaira(sale.total)}</span>
              </div>
            </div>
            <ul className="max-h-40 space-y-1 overflow-auto text-xs">
              {sale.items.map((it) => (
                <li key={it.menu_item_id} className="flex justify-between">
                  <span>
                    {it.qty}× {it.name}
                  </span>
                  <span>{formatNaira(it.price * it.qty)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>
            New Sale
          </Button>
          {sale && (
            <>
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/cashier/receipt/$id", params: { id: sale.id } })}
              >
                Open Receipt
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const w = window.open(`/cashier/receipt/${sale.id}?autoprint=1`, "_blank");
                  if (!w) toast.error("Popup blocked");
                }}
              >
                <Printer className="mr-1 h-4 w-4" /> Print Receipt
              </Button>
              <Button onClick={() => downloadCashierReceiptPdf(sale)}>
                <Download className="mr-1 h-4 w-4" /> Download PDF
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CashierReportDialog({
  open,
  onOpenChange,
  sales,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sales: CashierSale[];
}) {
  const [range, setRange] = useState<"today" | "yesterday" | "week">("today");
  const r = rangeFor(range);
  const inRange = sales.filter((s) => {
    const t = new Date(s.created_at).getTime();
    return t >= r.from && t < r.to;
  });
  const byMethod: Record<CashierPaymentMethod, number> = { cash: 0, pos: 0, transfer: 0, opay: 0 };
  let items = 0;
  for (const s of inRange) {
    byMethod[s.payment_method] += s.total;
    for (const i of s.items) items += i.qty;
  }
  const totalRev = inRange.reduce((s, x) => s + x.total, 0);

  // Build a shared report so we can reuse PDF/XLSX writers.
  const reportOrders: ReportOrder[] = inRange.map((s) => ({
    code: s.code,
    customerName: s.customer_name || "Walk-in",
    phone: "",
    createdAt: new Date(s.created_at).getTime(),
    pickupTime: paymentLabel(s.payment_method),
    paymentStatus: "paid",
    pickupStatus: "collected",
    items: s.items.map((i) => ({
      name: i.name,
      qty: i.qty,
      price: i.price,
      vendorType: i.vendor_type,
      preparationStatus: "collected",
    })),
  }));
  const report = computeReport({
    orders: reportOrders,
    scope: "all" as ReportScope,
    from: r.from,
    to: r.to,
    rangeLabel: r.label + " (Walk-in)",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>End of Day Report · Walk-in</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          {(["today", "yesterday", "week"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={range === k ? "default" : "outline"}
              onClick={() => setRange(k)}
            >
              {k === "today" ? "Today" : k === "yesterday" ? "Yesterday" : "This Week"}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Cash" value={formatNaira(byMethod.cash)} />
          <Stat label="POS" value={formatNaira(byMethod.pos)} />
          <Stat label="Transfer" value={formatNaira(byMethod.transfer)} />
          <Stat label="OPay" value={formatNaira(byMethod.opay)} />
          <Stat label="Transactions" value={String(inRange.length)} />
          <Stat label="Items Sold" value={String(items)} />
          <Stat label="Revenue" value={formatNaira(totalRev)} highlight />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => downloadReportXlsx(report)}>
            Download Excel
          </Button>
          <Button onClick={() => downloadReportPdf(report)}>Download PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={"rounded-lg border border-border p-2 " + (highlight ? "bg-primary text-primary-foreground" : "bg-card")}>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
