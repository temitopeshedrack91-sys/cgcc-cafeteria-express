import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Search, ShoppingCart } from "lucide-react";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CATEGORIES, DEFAULT_MENU, type MenuCategory } from "@/lib/menu-data";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const searchSchema = z.object({
  cat: z.enum(CATEGORIES as [MenuCategory, ...MenuCategory[]]).optional(),
});

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu · CGCC Cafeteria Express" },
      { name: "description", content: "Browse meals, proteins, drinks and more from the CGCC cafeteria." },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: MenuPage,
});

function MenuPage() {
  const { cat } = Route.useSearch();
  const navigate = Route.useNavigate();
  const orderingOpen = useStore((s) => s.orderingOpen);
  const menuState = useStore((s) => s.menuState);
  const cartCount = useStore((s) => s.cart.reduce((n, c) => n + c.qty, 0));
  const activeCat: MenuCategory = cat ?? "Meals";
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = DEFAULT_MENU.filter((m) => menuState[m.id]?.available !== false);
  const items = q
    ? visible.filter((m) => m.name.toLowerCase().includes(q))
    : visible.filter((m) => m.category === activeCat);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-32">
      <div className="mb-4">
        <h1 className="font-display text-3xl font-bold">Menu</h1>
        <p className="text-sm text-muted-foreground">Fresh from the CGCC cafeteria.</p>
      </div>

      {!orderingOpen && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Online ordering is currently unavailable. Please visit the cafeteria directly.
        </p>
      )}

      {/* Search */}
      <div className="mb-3 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1 shadow-soft focus-within:border-brand">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search food, drinks or snacks..."
          className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      {/* Category tabs */}
      <div className="-mx-4 mb-5 overflow-x-auto px-4">
        <div className="flex gap-2 pb-2">
          {CATEGORIES.map((c) => {
            const active = !q && c === activeCat;
            return (
              <button
                key={c}
                onClick={() => {
                  setQuery("");
                  navigate({ search: { cat: c } });
                }}
                className={
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : "border-border bg-card text-foreground hover:border-brand")
                }
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No menu item found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((i) => (
            <MenuItemCard key={i.id} item={i} />
          ))}
        </div>
      )}

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto max-w-md px-4">
          <Button asChild size="lg" className="h-14 w-full rounded-full shadow-elegant">
            <Link to="/cart">
              <ShoppingCart className="mr-2 h-5 w-5" />
              View cart ({cartCount} {cartCount === 1 ? "item" : "items"})
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
