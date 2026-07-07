import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actions, formatNaira, useStore } from "@/lib/store";
import type { MenuItem } from "@/lib/menu-data";
import { toast } from "sonner";

export function MenuItemCard({ item }: { item: MenuItem }) {
  const [qty, setQty] = useState(1);
  const available = useStore((s) => s.menuState[item.id]?.available ?? true);

  const soldOut = !available;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant">
      <div className="relative flex h-32 items-center justify-center bg-gradient-brand text-6xl">
        <span aria-hidden>{item.emoji}</span>
        {soldOut && (
          <span className="absolute right-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive-foreground">
            Sold out
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="font-display text-base font-semibold leading-tight">{item.name}</h3>
          {item.description && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-primary">{formatNaira(item.price)}</p>
          <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-40"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={soldOut}
              aria-label="Decrease"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-6 text-center text-sm font-semibold">{qty}</span>
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-40"
              onClick={() => setQty((q) => q + 1)}
              disabled={soldOut}
              aria-label="Increase"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
        <Button
          className="w-full"
          size="sm"
          disabled={soldOut}
          onClick={() => {
            actions.addToCart(item.id, qty);
            toast.success(`${qty} × ${item.name} added`, { duration: 1600 });
            setQty(1);
          }}
        >
          <ShoppingBag className="mr-1 h-4 w-4" />
          Add to cart
        </Button>
      </div>
    </div>
  );
}
