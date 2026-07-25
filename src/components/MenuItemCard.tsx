import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actions, formatNaira, useStore } from "@/lib/store";
import type { MenuItem } from "@/lib/menu-data";
import { toast } from "sonner";

export function MenuItemCard({ item }: { item: MenuItem }) {
  const [qty, setQty] = useState(1);
  const info = useStore((s) => s.menuState[item.id]);
  const inCartQty = useStore((s) => s.cart.find((c) => c.itemId === item.id)?.qty ?? 0);
  const available = info?.available ?? true;
  const stockOnline = info?.stockOnline ?? 0;
  const stockQty = info?.stockQty ?? 0;

  const totallySoldOut = !available || stockQty === 0;
  const soldOutOnline = !totallySoldOut && stockOnline === 0;
  const remainingOnline = Math.max(0, stockOnline - inCartQty);
  const canAdd = !totallySoldOut && !soldOutOnline && remainingOnline > 0;
  const cappedQty = Math.min(qty, Math.max(1, remainingOnline));

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft transition hover:border-brand hover:shadow-elegant">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-display text-sm font-semibold leading-tight sm:text-base">
            {item.name}
          </h3>
          {totallySoldOut ? (
            <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-destructive-foreground">
              Sold out
            </span>
          ) : soldOutOnline ? (
            <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900">
              Sold out online
            </span>
          ) : remainingOnline <= 3 ? (
            <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900">
              {remainingOnline} left
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm font-bold text-primary">{formatNaira(item.price)}</p>
      </div>

      <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
        <button
          type="button"
          className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-40"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          disabled={!canAdd}
          aria-label="Decrease"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="min-w-5 text-center text-sm font-semibold">{cappedQty}</span>
        <button
          type="button"
          className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-40"
          onClick={() => {
            setQty((q) => {
              if (q + 1 > remainingOnline) {
                toast.error(`Only ${remainingOnline} ${item.name} available online`);
                return q;
              }
              return q + 1;
            });
          }}
          disabled={!canAdd || cappedQty >= remainingOnline}
          aria-label="Increase"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <Button
        size="sm"
        className="h-9 shrink-0 rounded-full px-3"
        disabled={!canAdd}
        onClick={() => {
          const addQty = Math.min(cappedQty, remainingOnline);
          if (addQty <= 0) {
            toast.error(`Only ${stockOnline} ${item.name} available online`);
            return;
          }
          actions.addToCart(item.id, addQty);
          toast.success(`${addQty} × ${item.name} added`, { duration: 1400 });
          setQty(1);
        }}
      >
        {totallySoldOut || soldOutOnline ? (
          <span className="text-xs">Sold Out</span>
        ) : (
          <>
            <ShoppingBag className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Add</span>
          </>
        )}
      </Button>
    </div>
  );
}
