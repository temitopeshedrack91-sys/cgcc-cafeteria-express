import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/vendor/")({
  head: () => ({
    meta: [
      { title: "Vendor Dashboard · CGCC Cafeteria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendorDashboard,
});

type PrepStatus = "pending" | "preparing" | "ready" | "collected";

type VendorOrderItem = {
  id: string;
  order_id: string;
  name: string;
  qty: number;
  price: number;
  preparation_status: PrepStatus;
};

type VendorOrder = {
  id: string;
  code: string;
  customer_name: string;
  phone: string;
  note: string | null;
  order_type: "dine-in" | "takeaway";
  pickup_time: string | null;
  payment_status: "paid" | "unpaid";
  pickup_status: string;
  created_at: string;
  items: VendorOrderItem[];
};

const VENDOR_LABELS: Record<string, string> = {
  food: "Food Vendor",
  snacks: "Snacks Vendor",
  coffee: "Coffee Vendor",
  drinks: "Drinks (Cafeteria Management)",
};

const NEXT_STATUS: Record<PrepStatus, PrepStatus | null> = {
  pending: "preparing",
  preparing: "ready",
  ready: "collected",
  collected: null,
};

const STATUS_STYLE: Record<PrepStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  preparing: "bg-blue-100 text-blue-900 border-blue-300",
  ready: "bg-emerald-100 text-emerald-900 border-emerald-300",
  collected: "bg-muted text-muted-foreground border-border",
};

function VendorDashboard() {
  const navigate = useNavigate();
  const [vendorType, setVendorType] = useState<string | null>(null);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, code, customer_name, phone, note, order_type, pickup_time, payment_status, pickup_status, created_at, order_items ( id, order_id, name, qty, price, preparation_status )",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []).map((o: any) => ({
        id: o.id,
        code: o.code,
        customer_name: o.customer_name,
        phone: o.phone,
        note: o.note,
        order_type: o.order_type,
        pickup_time: o.pickup_time,
        payment_status: o.payment_status,
        pickup_status: o.pickup_status,
        created_at: o.created_at,
        items: (o.order_items ?? []) as VendorOrderItem[],
      })) as VendorOrder[];
      // RLS already filters items to this vendor's type
      setOrders(rows.filter((o) => o.items.length > 0));
    } catch (e: any) {
      console.error("[vendor] load failed", e);
      toast.error("Failed to load orders");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        navigate({ to: "/vendor/login", replace: true });
        return;
      }
      const { data: v } = await supabase
        .from("vendors")
        .select("vendor_type, active")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!v || !v.active) {
        await supabase.auth.signOut();
        navigate({ to: "/vendor/login", replace: true });
        return;
      }
      if (cancelled) return;
      setVendorType(v.vendor_type);
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, load]);

  useEffect(() => {
    if (!vendorType) return;
    const channel = supabase
      .channel("vendor-orders-" + vendorType)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [vendorType, load]);

  async function updateItem(itemId: string, status: PrepStatus) {
    const prev = orders;
    setOrders((os) =>
      os.map((o) => ({
        ...o,
        items: o.items.map((it) =>
          it.id === itemId ? { ...it, preparation_status: status } : it,
        ),
      })),
    );
    const { error } = await supabase
      .from("order_items")
      .update({ preparation_status: status })
      .eq("id", itemId);
    if (error) {
      console.error(error);
      toast.error("Update failed");
      setOrders(prev);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/vendor/login", replace: true });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/40">
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/vendor" className="flex items-center gap-3">
            <Logo className="h-8 w-auto" />
            <span className="font-display text-sm font-semibold">
              {vendorType ? VENDOR_LABELS[vendorType] : "Vendor"}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => void load()}
              disabled={refreshing}
            >
              <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-display text-3xl font-bold">My Orders</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Only items assigned to you are shown. Updates sync live.
        </p>

        {orders.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
            No active orders yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-border bg-background p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-primary">{o.code}</p>
                    <p className="text-sm font-semibold">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{o.phone}</p>
                  </div>
                  <div className="text-right text-[10px] uppercase text-muted-foreground">
                    <div>{new Date(o.created_at).toLocaleTimeString()}</div>
                    <div>{o.order_type}</div>
                    {o.pickup_time && <div>Pickup: {o.pickup_time}</div>}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase">
                  <span
                    className={
                      "rounded-full border px-2 py-0.5 " +
                      (o.payment_status === "paid"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-amber-100 text-amber-900 border-amber-300")
                    }
                  >
                    Payment: {o.payment_status}
                  </span>
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                    Order: {o.pickup_status}
                  </span>
                </div>

                {o.note && (
                  <p className="mt-2 rounded-md border border-dashed border-border bg-muted/40 p-2 text-xs italic">
                    Note: {o.note}
                  </p>
                )}

                <ul className="mt-3 space-y-2">
                  {o.items.map((it) => {
                    const next = NEXT_STATUS[it.preparation_status];
                    return (
                      <li
                        key={it.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2"
                      >
                        <div>
                          <p className="text-sm font-semibold">
                            {it.qty}× {it.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatNaira(it.price * it.qty)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase " +
                              STATUS_STYLE[it.preparation_status]
                            }
                          >
                            {it.preparation_status}
                          </span>
                          {next && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void updateItem(it.id, next)}
                            >
                              Mark {next}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
