import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { actions, formatNaira, useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({
    meta: [
      ...pageMeta("Menu Management · CGCC Admin", "Manage CGCC menu availability and ordering."),
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <MenuAdmin />
      </AdminShell>
    </AdminGuard>
  ),
});

function MenuAdmin() {
  const menu = useStore((s) => s.menu);
  const categories = useStore((s) => s.categories);
  const menuState = useStore((s) => s.menuState);
  const orderingOpen = useStore((s) => s.orderingOpen);
  const [q, setQ] = useState("");

  const filter = (name: string) =>
    !q.trim() || name.toLowerCase().includes(q.trim().toLowerCase());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Menu Management</h1>
        <p className="text-sm text-muted-foreground">
          Toggle items as Available or Sold Out. Sold-out items can&apos;t be ordered online.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div>
          <p className="font-display text-lg font-semibold">Online Ordering</p>
          <p className="text-sm text-muted-foreground">
            {orderingOpen
              ? "Customers can place online pre-orders."
              : "Customers see the closed message on all pages."}
          </p>
        </div>
        <label className="inline-flex items-center gap-2">
          <span className="text-sm font-medium">
            {orderingOpen ? "Open" : "Closed"}
          </span>
          <Switch
            checked={orderingOpen}
            onCheckedChange={(v) => actions.setOrderingOpen(Boolean(v))}
          />
        </label>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 shadow-soft">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          className="border-0 shadow-none focus-visible:ring-0"
          placeholder="Search menu"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        {categories.map((cat) => {
          const items = menu.filter((m) => m.category === cat && filter(m.name));
          if (items.length === 0) return null;
          return (
            <section key={cat}>
              <h2 className="mb-2 font-display text-lg font-semibold">{cat}</h2>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {items.map((item) => {
                  const available = menuState[item.id]?.available ?? true;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          loading="lazy"
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : null}
                      <div className="flex-1">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatNaira(item.price)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={
                            "text-[10px] font-bold uppercase " +
                            (available ? "text-emerald-600" : "text-destructive")
                          }
                        >
                          {available ? "Available" : "Sold out"}
                        </span>
                        <Switch
                          checked={available}
                          onCheckedChange={() => actions.toggleAvailable(item.id)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
