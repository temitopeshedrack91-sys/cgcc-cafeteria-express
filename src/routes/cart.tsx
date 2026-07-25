import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actions, cartTotal, formatNaira, useStore } from "@/lib/store";
import { DEFAULT_MENU } from "@/lib/menu-data";
import { toast } from "sonner";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your Cart · CGCC Cafeteria Express" }] }),
  component: CartPage,
});

function CartPage() {
  const cart = useStore((s) => s.cart);
  const menuState = useStore((s) => s.menuState);
  const total = cartTotal(cart, DEFAULT_MENU);
  const hasStockIssue = cart.some((c) => {
    const info = menuState[c.itemId];
    if (!info) return false;
    return !info.available || info.stockOnline < c.qty;
  });

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="text-6xl">🛒</div>
        <h1 className="mt-4 font-display text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">Add some delicious items from the menu.</p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/menu">Browse menu</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-40">
      <h1 className="font-display text-3xl font-bold">Your cart</h1>
      <p className="text-sm text-muted-foreground">Review your items before checkout.</p>

      <div className="mt-6 space-y-3">
        {cart.map((c) => {
          const item = DEFAULT_MENU.find((m) => m.id === c.itemId);
          if (!item) return null;
          const info = menuState[c.itemId];
          const stockOnline = info?.stockOnline ?? 0;
          const available = info?.available ?? true;
          const overStock = !available || c.qty > stockOnline;
          const atMax = c.qty >= stockOnline;
          return (
            <div
              key={c.itemId}
              className={
                "flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft " +
                (overStock ? "border-destructive/60" : "border-border")
              }
            >
              <img
                src={item.image}
                alt={item.name}
                loading="lazy"
                className="h-16 w-16 rounded-xl object-cover"
              />
              <div className="flex-1">
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-muted-foreground">{formatNaira(item.price)}</p>
                {overStock && (
                  <p className="mt-1 text-xs font-semibold text-destructive">
                    Only {stockOnline} available online — reduce to continue.
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1 rounded-full border border-border p-1">
                  <button
                    className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted"
                    onClick={() => actions.setQty(c.itemId, c.qty - 1)}
                    aria-label="Decrease"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="min-w-6 text-center text-sm font-semibold">{c.qty}</span>
                  <button
                    className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted disabled:opacity-40"
                    onClick={() => {
                      if (c.qty + 1 > stockOnline) {
                        toast.error(`Only ${stockOnline} ${item.name} available online`);
                        return;
                      }
                      actions.setQty(c.itemId, c.qty + 1);
                    }}
                    disabled={atMax}
                    aria-label="Increase"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  onClick={() => actions.removeFromCart(c.itemId)}
                  className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatNaira(total)}</span>
        </div>
        <div className="mt-2 flex justify-between text-lg font-bold">
          <span>Grand total</span>
          <span className="text-primary">{formatNaira(total)}</span>
        </div>
      </div>

      {hasStockIssue && (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          Some items exceed available online stock. Adjust the quantities above to continue.
        </p>
      )}

      <div className="fixed inset-x-0 bottom-4 z-40 mx-auto max-w-md px-4">
        <Button asChild size="lg" className="h-14 w-full rounded-full shadow-elegant" disabled={hasStockIssue}>
          <Link to={hasStockIssue ? "/cart" : "/checkout"}>Proceed to checkout</Link>
        </Button>
      </div>
    </div>
  );
}
