import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CATEGORIES, DEFAULT_MENU, type MenuCategory } from "@/lib/menu-data";
import { useStore } from "@/lib/store";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const cartCount = useStore((s) => s.cart.reduce((n, c) => n + c.qty, 0));
  const activeCat: MenuCategory = cat ?? "Meals";

  const items = DEFAULT_MENU.filter((m) => m.category === activeCat);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-32">
      <div className="mb-4">
        <h1 className="font-display text-3xl font-bold">Menu</h1>
        <p className="text-sm text-muted-foreground">Fresh from the CGCC cafeteria.</p>
      </div>

      {!orderingOpen && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Online ordering is currently unavailable. Please visit the cafeteria directly.
        </p>
      )}

      {/* Category tabs */}
      <div className="-mx-4 mb-6 overflow-x-auto px-4">
        <div className="flex gap-2 pb-2">
          {CATEGORIES.map((c) => {
            const active = c === activeCat;
            return (
              <button
                key={c}
                onClick={() => navigate({ search: { cat: c } })}
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {items.map((i) => (
          <MenuItemCard key={i.id} item={i} />
        ))}
      </div>

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
