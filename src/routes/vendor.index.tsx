import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  FileDown,
  FileText,
  LogOut,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrderByCode, formatNaira } from "@/lib/store";
import { toast } from "sonner";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { ReportDialog } from "@/components/ReportDialog";
import type { ReportOrder, ReportScope } from "@/lib/reports";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { InventoryPanel } from "@/components/InventoryPanel";
import { BusinessDayFilter } from "@/components/BusinessDayFilter";
import { defaultFilter, matchesFilter, type BusinessDayFilter as Filter } from "@/lib/business-day";

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
  vendor_type?: string | null;
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
  business_day: string | null;
  archived_at: string | null;
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

type Alert = {
  id: string;
  code: string;
  customerName: string;
  pickupTime: string | null;
};

function formatDayLine(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "long" });
  const date = d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${date} · ${time}`;
}

function VendorDashboard() {
  const navigate = useNavigate();
  const [vendorType, setVendorType] = useState<string | null>(null);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [reportOpen, setReportOpen] = useState(false);
  const [tab, setTab] = useState<"orders" | "inventory">("orders");
  const knownIdsRef = useRef<Set<string> | null>(null);
  const playBeep = useNotificationSound();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, code, customer_name, phone, note, order_type, pickup_time, payment_status, pickup_status, created_at, order_items ( id, order_id, name, qty, price, preparation_status, vendor_type )",
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
      const visible = rows.filter((o) => o.items.length > 0);

      // Diff for notifications — only trigger AFTER first load has established baseline.
      if (knownIdsRef.current !== null) {
        const prev = knownIdsRef.current;
        const fresh = visible.filter((o) => !prev.has(o.id));
        if (fresh.length > 0) {
          for (const o of fresh) {
            playBeep();
            setAlerts((a) => [
              {
                id: o.id,
                code: o.code,
                customerName: o.customer_name,
                pickupTime: o.pickup_time,
              },
              ...a,
            ]);
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try {
                new Notification(`New Order ${o.code}`, {
                  body: `${o.customer_name}${o.pickup_time ? " · Pickup " + o.pickup_time : ""}`,
                  tag: o.id,
                });
              } catch {}
            }
          }
        }
      }
      knownIdsRef.current = new Set(visible.map((o) => o.id));
      setOrders(visible);
    } catch (e: any) {
      console.error("[vendor] load failed", e);
      toast.error("Failed to load orders");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [playBeep]);

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

  const counters = useMemo(() => {
    let newCt = 0,
      prep = 0,
      ready = 0,
      collected = 0,
      pending = 0;
    for (const o of orders) {
      if (o.payment_status === "unpaid") pending += 1;
      for (const it of o.items) {
        if (it.preparation_status === "pending") newCt += 1;
        else if (it.preparation_status === "preparing") prep += 1;
        else if (it.preparation_status === "ready") ready += 1;
        else if (it.preparation_status === "collected") collected += 1;
      }
    }
    return { newCt, prep, ready, collected, pending };
  }, [orders]);

  const reportOrders = useMemo<ReportOrder[]>(
    () =>
      orders.map((o) => ({
        code: o.code,
        customerName: o.customer_name,
        phone: o.phone,
        createdAt: new Date(o.created_at).getTime(),
        pickupTime: o.pickup_time,
        paymentStatus: o.payment_status,
        pickupStatus: o.pickup_status,
        items: o.items.map((it) => ({
          name: it.name,
          qty: it.qty,
          price: it.price,
          vendorType: it.vendor_type ?? vendorType,
          preparationStatus: it.preparation_status,
        })),
      })),
    [orders, vendorType],
  );

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

  async function downloadOrderReceipt(code: string) {
    try {
      const full = await fetchOrderByCode(code);
      if (!full) {
        toast.error("Receipt not found");
        return;
      }
      await downloadReceiptPdf(full);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate receipt");
    }
  }

  async function requestNotifications() {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") toast.success("Notifications enabled");
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

  const scope = (vendorType ?? "food") as ReportScope;

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
            {notifPermission !== "granted" && notifPermission !== "unsupported" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={() => void requestNotifications()}
              >
                <BellRing className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Enable Alerts</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => setReportOpen(true)}
            >
              <FileDown className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">End of Day Report</span>
            </Button>
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
        <div className="mb-4 flex items-center gap-2">
          <Button size="sm" variant={tab === "orders" ? "default" : "outline"} onClick={() => setTab("orders")}>
            Orders
          </Button>
          <Button size="sm" variant={tab === "inventory" ? "default" : "outline"} onClick={() => setTab("inventory")}>
            Inventory Management
          </Button>
        </div>

        {tab === "inventory" ? (
          <InventoryPanel scope={vendorType} title="Inventory Management" />
        ) : (
        <>
        <h1 className="font-display text-3xl font-bold">My Orders</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Only items assigned to you are shown. Updates sync live.
        </p>

        {alerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 shadow-md animate-in slide-in-from-top-2"
              >
                <div>
                  <p className="font-display text-sm font-bold text-amber-900">
                    🔔 New Order Received
                  </p>
                  <p className="mt-0.5 font-display text-lg font-bold text-amber-900">
                    {a.code}
                    {a.pickupTime && (
                      <span className="ml-2 text-sm font-semibold">Pickup: {a.pickupTime}</span>
                    )}
                  </p>
                  <p className="text-xs text-amber-900/80">Customer: {a.customerName}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAlerts((xs) => xs.filter((x) => x.id !== a.id))}
                >
                  <X className="mr-1 h-3 w-3" />
                  Acknowledge
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <CounterCard label="New" value={counters.newCt} tint="bg-amber-50" />
          <CounterCard label="Preparing" value={counters.prep} tint="bg-blue-50" />
          <CounterCard label="Ready" value={counters.ready} tint="bg-emerald-50" />
          <CounterCard label="Collected" value={counters.collected} tint="bg-muted" />
          <CounterCard label="Pending Payment" value={counters.pending} tint="bg-rose-50" />
        </div>

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
                    <div>{o.order_type}</div>
                    {o.pickup_time && <div>Pickup: {o.pickup_time}</div>}
                  </div>
                </div>

                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  {formatDayLine(o.created_at)}
                </p>

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

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void downloadOrderReceipt(o.code)}
                  >
                    <FileDown className="mr-1 h-3 w-3" />
                    Download PDF
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/receipt/$code" params={{ code: o.code }} target="_blank">
                      <FileText className="mr-1 h-3 w-3" />
                      View Full Receipt
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </main>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        scope={scope}
        orders={reportOrders}
      />
    </div>
  );
}

function CounterCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className={"rounded-xl border border-border p-3 shadow-soft " + tint}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
