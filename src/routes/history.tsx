import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Search, ArrowLeft, Inbox, Phone, KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHistoryCodes, rememberOrder } from "@/lib/history";
import { fetchOrderByCode, formatNaira, type Order, type PaymentStatus, type OrderStatus } from "@/lib/store";
import { pickupLabel, pickupTone, paymentTone, toneClasses } from "@/lib/order-status";
import { loadCustomerProfile } from "@/lib/customer-profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "My Orders · CGCC Cafeteria Express" },
      {
        name: "description",
        content: "See your recent CGCC Cafeteria orders on this device, or recover past receipts with your phone number.",
      },
    ],
  }),
  component: HistoryPage,
});

type RecoveryRow = {
  code: string;
  receipt_no: string;
  customer_name: string;
  pickup_time: string | null;
  total: number;
  payment_status: PaymentStatus;
  pickup_status: OrderStatus;
  created_at: string;
};

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(ts: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) {
    return `Last ${new Date(ts).toLocaleDateString(undefined, { weekday: "long" })}`;
  }
  if (diff >= 7 && diff < 30) return "Older Orders";
  return "Older Orders";
}

function groupOrders(orders: Order[]): { label: string; items: Order[] }[] {
  const groups = new Map<string, Order[]>();
  const order: string[] = [];
  for (const o of orders) {
    const label = dayLabel(o.createdAt);
    if (!groups.has(label)) {
      groups.set(label, []);
      order.push(label);
    }
    groups.get(label)!.push(o);
  }
  return order.map((label) => ({ label, items: groups.get(label)! }));
}

function HistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [recoverOpen, setRecoverOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const codes = getHistoryCodes();
      if (codes.length === 0) {
        setLoading(false);
        return;
      }
      const results = await Promise.all(
        codes.map(async (c) => {
          try {
            return await fetchOrderByCode(c);
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const list = results
        .filter((o): o is Order => !!o)
        .sort((a, b) => b.createdAt - a.createdAt);
      setOrders(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupOrders(orders), [orders]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-16">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Home
          </Link>
        </Button>
      </div>

      <h1 className="font-display text-3xl font-bold">My Orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Orders placed from this device. Tap any order to view the full receipt.
      </p>

      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No orders on this device yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Placed orders on another phone? Use Recover My Orders below.
            </p>
            <Button asChild className="mt-5 rounded-full">
              <Link to="/menu">Place an order</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.label}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </h2>
                <ul className="space-y-3">
                  {g.items.map((o) => (
                    <OrderRow key={o.code} order={o} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Changed phones or cleared your browser? Find your past receipts.
          </p>
          <Button
            onClick={() => setRecoverOpen(true)}
            variant="secondary"
            className="mt-3 rounded-full"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Recover My Orders
          </Button>
        </div>
      </div>

      {recoverOpen && (
        <RecoverDialog
          onClose={() => setRecoverOpen(false)}
          onPick={(code) => {
            rememberOrder(code);
            navigate({ to: "/receipt/$code", params: { code } });
          }}
        />
      )}
    </div>
  );
}

function OrderRow({ order: o }: { order: Order }) {
  const pTone = pickupTone(o.pickupStatus);
  const payTone = paymentTone(o.paymentStatus);
  const d = new Date(o.createdAt);
  return (
    <li>
      <Link
        to="/receipt/$code"
        params={{ code: o.code }}
        className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand hover:shadow-elegant"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-primary">{o.code}</span>
            <span className="text-xs text-muted-foreground">· {o.receiptNo}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            {o.pickupTime && (
              <span className="ml-2 font-semibold text-primary">Pickup {o.pickupTime}</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${toneClasses[payTone]}`}>
              {o.paymentStatus === "paid" ? "Paid" : "Payment Pending"}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${toneClasses[pTone]}`}>
              {pickupLabel(o.pickupStatus)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-primary tabular-nums">{formatNaira(o.total)}</div>
          <ChevronRight className="ml-auto mt-1 h-4 w-4 text-muted-foreground" />
        </div>
      </Link>
    </li>
  );
}

function RecoverDialog({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (code: string) => void;
}) {
  const savedProfile = loadCustomerProfile();
  const [mode, setMode] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(savedProfile.phone ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RecoveryRow[] | null>(null);

  async function searchByPhone(e: React.FormEvent) {
    e.preventDefault();
    const clean = phone.trim();
    if (clean.length < 6) {
      toast.error("Enter the phone number you used to place the order.");
      return;
    }
    setBusy(true);
    setResults(null);
    try {
      const { data, error } = await supabase.rpc("get_orders_by_phone", { _phone: clean });
      if (error) throw error;
      const rows = (data as RecoveryRow[]) ?? [];
      setResults(rows);
      if (rows.length === 0) toast("No orders found for that phone number.");
    } catch (err) {
      console.error(err);
      toast.error("Could not search. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function searchByCode(e: React.FormEvent) {
    e.preventDefault();
    const q = code.trim();
    if (!q) return;
    setBusy(true);
    try {
      const candidate = q.toUpperCase().startsWith("CG-") ? q.toUpperCase() : q;
      const found = await fetchOrderByCode(candidate);
      if (found) {
        onPick(found.code);
      } else {
        toast.error("No order found for that code.");
      }
    } catch {
      toast.error("Search failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-card shadow-elegant sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-display text-lg font-bold">Recover My Orders</h2>
            <p className="text-xs text-muted-foreground">
              Find receipts placed on another phone or browser.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-border p-3">
          <button
            onClick={() => {
              setMode("phone");
              setResults(null);
            }}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold ${
              mode === "phone" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <Phone className="mr-1 inline h-3.5 w-3.5" />
            By phone number
          </button>
          <button
            onClick={() => {
              setMode("code");
              setResults(null);
            }}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold ${
              mode === "code" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <Search className="mr-1 inline h-3.5 w-3.5" />
            By order code
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {mode === "phone" ? (
            <form onSubmit={searchByPhone} className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Phone number
              </label>
              <Input
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08012345678"
                className="h-11"
              />
              <Button type="submit" disabled={busy} className="h-11 w-full rounded-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find my orders"}
              </Button>

              {results && results.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {results.map((r) => {
                    const d = new Date(r.created_at);
                    const payT = paymentTone(r.payment_status);
                    const pT = pickupTone(r.pickup_status);
                    return (
                      <li key={r.code}>
                        <button
                          onClick={() => onPick(r.code)}
                          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-brand"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-primary">{r.code}</span>
                              <span className="text-[10px] text-muted-foreground">· {r.receipt_no}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                              {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${toneClasses[payT]}`}>
                                {r.payment_status === "paid" ? "Paid" : "Pending"}
                              </span>
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${toneClasses[pT]}`}>
                                {pickupLabel(r.pickup_status)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-primary tabular-nums">{formatNaira(r.total)}</div>
                            <ChevronRight className="ml-auto mt-1 h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {results && results.length === 0 && (
                <p className="pt-2 text-center text-sm text-muted-foreground">
                  No orders match that phone number.
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={searchByCode} className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Order code
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CG-104"
                className="h-11"
              />
              <Button type="submit" disabled={busy} className="h-11 w-full rounded-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open receipt"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
