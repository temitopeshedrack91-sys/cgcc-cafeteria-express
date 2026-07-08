import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Power } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { actions, formatNaira, useStore, type OrderStatus } from "@/lib/store";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Dashboard · CGCC Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <Dashboard />
      </AdminShell>
    </AdminGuard>
  ),
});

function isToday(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  confirmed: "bg-indigo-100 text-indigo-900 border-indigo-300",
  preparing: "bg-blue-100 text-blue-900 border-blue-300",
  ready: "bg-emerald-100 text-emerald-900 border-emerald-300",
  collected: "bg-muted text-muted-foreground border-border",
};

function Dashboard() {
  const orders = useStore((s) => s.orders);
  const orderingOpen = useStore((s) => s.orderingOpen);
  const [q, setQ] = useState("");

  const todays = orders.filter((o) => isToday(o.createdAt));
  const counts = {
    pending: todays.filter((o) => o.pickupStatus === "pending").length,
    preparing: todays.filter((o) => o.pickupStatus === "preparing").length,
    ready: todays.filter((o) => o.pickupStatus === "ready").length,
    collected: todays.filter((o) => o.pickupStatus === "collected").length,
  };
  const revenue = todays
    .filter((o) => o.paymentStatus === "paid")
    .reduce((s, o) => s + o.total, 0);

  const filtered = orders.filter((o) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      o.code.toLowerCase().includes(s) ||
      o.customerName.toLowerCase().includes(s) ||
      o.phone.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Today's orders at a glance.</p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-soft">
          <Power className={"h-4 w-4 " + (orderingOpen ? "text-emerald-600" : "text-destructive")} />
          <span className="text-sm font-medium">
            Ordering {orderingOpen ? "Open" : "Closed"}
          </span>
          <Switch
            checked={orderingOpen}
            onCheckedChange={(v) => actions.setOrderingOpen(Boolean(v))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Pending" value={counts.pending} tint="bg-amber-50" />
        <StatCard label="Preparing" value={counts.preparing} tint="bg-blue-50" />
        <StatCard label="Ready" value={counts.ready} tint="bg-emerald-50" />
        <StatCard label="Collected" value={counts.collected} tint="bg-muted" />
        <div className="col-span-2 rounded-2xl bg-primary p-4 text-primary-foreground shadow-soft md:col-span-1">
          <p className="text-xs uppercase tracking-wider text-brand">Today's revenue</p>
          <p className="mt-2 font-display text-2xl font-bold">{formatNaira(revenue)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            className="border-0 shadow-none focus-visible:ring-0"
            placeholder="Search by order code, name or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No orders yet. Once customers place orders, they'll appear here.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map((o) => (
              <div
                key={o.code}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-primary">{o.code}</p>
                    <p className="text-sm font-semibold">{o.customerName}</p>
                    <p className="text-xs text-muted-foreground">{o.phone}</p>
                  </div>
                  <span
                    className={
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase " +
                      STATUS_COLORS[o.pickupStatus]
                    }
                  >
                    {o.pickupStatus}
                  </span>
                </div>

                <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                  {o.items.slice(0, 4).map((i) => (
                    <li key={i.id}>
                      {i.qty}× {i.name}
                    </li>
                  ))}
                  {o.items.length > 4 && <li>+ {o.items.length - 4} more</li>}
                </ul>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-primary">{formatNaira(o.total)}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{o.orderType}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant={o.pickupStatus === "preparing" ? "default" : "outline"}
                    onClick={() => actions.updateOrderStatus(o.code, "preparing")}
                  >
                    Preparing
                  </Button>
                  <Button
                    size="sm"
                    variant={o.pickupStatus === "ready" ? "default" : "outline"}
                    onClick={() => actions.updateOrderStatus(o.code, "ready")}
                  >
                    Ready
                  </Button>
                  <Button
                    size="sm"
                    variant={o.pickupStatus === "collected" ? "default" : "outline"}
                    onClick={() => actions.updateOrderStatus(o.code, "collected")}
                  >
                    Collected
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className={"rounded-2xl border border-border p-4 shadow-soft " + tint}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
