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
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft transition hover:border-brand hover:shadow-elegant">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-display text-sm font-semibold leading-tight sm:text-base">
            {item.name}
          </h3>
          {soldOut && (
            <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-destructive-foreground">
              Sold out
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-bold text-primary">{formatNaira(item.price)}</p>
      </div>

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
        <span className="min-w-5 text-center text-sm font-semibold">{qty}</span>
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

      <Button
        size="sm"
        className="h-9 shrink-0 rounded-full px-3"
        disabled={soldOut}
        onClick={() => {
          actions.addToCart(item.id, qty);
          toast.success(`${qty} × ${item.name} added`, { duration: 1400 });
          setQty(1);
        }}
      >
        <ShoppingBag className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">Add</span>
      </Button>
    </div>
  );
}
