import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2, Search, ArrowLeft, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHistoryCodes } from "@/lib/history";
import { fetchOrderByCode, formatNaira, type Order } from "@/lib/store";
import { pickupLabel, pickupTone, paymentTone, toneClasses } from "@/lib/order-status";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Order History · CGCC Cafeteria Express" },
      {
        name: "description",
        content: "View your previous CGCC Cafeteria orders and reopen any receipt.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

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
      setOrders(results.filter((o): o is Order => !!o));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      // Try as order code first; if not found, try to match receipt number in local list
      const codeCandidate = q.toUpperCase().startsWith("CG-") ? q.toUpperCase() : q;
      const found = await fetchOrderByCode(codeCandidate);
      if (found) {
        navigate({ to: "/receipt/$code", params: { code: found.code } });
        return;
      }
      const byReceipt = orders.find(
        (o) => o.receiptNo.toLowerCase() === q.toLowerCase(),
      );
      if (byReceipt) {
        navigate({ to: "/receipt/$code", params: { code: byReceipt.code } });
        return;
      }
      toast.error("No order found for that code or receipt number.");
    } catch {
      toast.error("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }

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

      <h1 className="font-display text-3xl font-bold">Order History</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reopen any receipt from this device, or look one up by code.
      </p>

      <form onSubmit={onSearch} className="mt-5 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Order Code (e.g. CG-104) or Receipt No."
            className="h-11 pl-9"
          />
        </div>
        <Button type="submit" disabled={searching} className="h-11 rounded-full px-5">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
        </Button>
      </form>

      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No previous orders on this device</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Have an order code? Use the search above to reopen your receipt.
            </p>
            <Button asChild className="mt-5 rounded-full">
              <Link to="/menu">Place an order</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const pTone = pickupTone(o.pickupStatus);
              const payTone = paymentTone(o.paymentStatus);
              const d = new Date(o.createdAt);
              return (
                <li key={o.code}>
                  <Link
                    to="/receipt/$code"
                    params={{ code: o.code }}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand hover:shadow-elegant"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-bold text-primary">
                          {o.code}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {o.receiptNo}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {d.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {o.pickupTime && (
                        <div className="mt-0.5 text-xs font-semibold text-primary">
                          Pickup: {o.pickupTime}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${toneClasses[payTone]}`}
                        >
                          {o.paymentStatus === "paid" ? "Paid" : "Payment Pending"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${toneClasses[pTone]}`}
                        >
                          {pickupLabel(o.pickupStatus)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary tabular-nums">
                        {formatNaira(o.total)}
                      </div>
                      <ChevronRight className="ml-auto mt-1 h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
