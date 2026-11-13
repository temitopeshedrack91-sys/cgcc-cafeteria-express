import { supabase } from "@/integrations/supabase/client";
import type { MenuItem } from "./menu-data";
import type { CartItem } from "./store";

export type StockSnapshot = Record<
  string,
  {
    available: boolean;
    stockOnline: number;
  }
>;

export type CartStockIssue = {
  itemId: string;
  name: string;
  requested: number;
  availableStock: number;
  reason: "sold_out" | "insufficient";
};

export function findCartStockIssues(
  cart: CartItem[],
  menu: Pick<MenuItem, "id" | "name">[],
  menuState: StockSnapshot,
): CartStockIssue[] {
  const issues: CartStockIssue[] = [];
  for (const c of cart) {
    const info = menuState[c.itemId];
    const name = menu.find((m) => m.id === c.itemId)?.name ?? "Item";
    if (!info || !info.available || info.stockOnline <= 0) {
      issues.push({
        itemId: c.itemId,
        name,
        requested: c.qty,
        availableStock: 0,
        reason: "sold_out",
      });
    } else if (c.qty > info.stockOnline) {
      issues.push({
        itemId: c.itemId,
        name,
        requested: c.qty,
        availableStock: info.stockOnline,
        reason: "insufficient",
      });
    }
  }
  return issues;
}

export function formatStockIssueMessage(issues: CartStockIssue[]): string {
  if (issues.length === 0) return "";
  return issues
    .map((issue) =>
      issue.reason === "sold_out"
        ? `${issue.name} was just sold out or paid for by another customer and is no longer available online.`
        : `Only ${issue.availableStock} unit(s) of ${issue.name} remain online (you have ${issue.requested}).`,
    )
    .join(" ");
}

/**
 * Fetches fresh `stock_online` and `available` directly from Supabase for all items
 * in the cart right before creating an order or starting payment.
 */
export async function verifyLiveStockForCart(
  cart: CartItem[],
  menu: Pick<MenuItem, "id" | "name">[],
): Promise<CartStockIssue[]> {
  if (cart.length === 0) return [];
  const ids = Array.from(new Set(cart.map((c) => c.itemId)));
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, available, stock_online")
    .in("id", ids);

  if (error) {
    // Let server-side create_customer_order enforce FOR UPDATE if transient read fails
    console.warn("[stock-guard] live stock check skipped", error);
    return [];
  }

  const snapshot: StockSnapshot = {};
  const liveMenu = [...menu];
  for (const row of data ?? []) {
    snapshot[row.id] = {
      available: Boolean(row.available),
      stockOnline: Number(row.stock_online ?? 0),
    };
    if (!liveMenu.some((m) => m.id === row.id)) {
      liveMenu.push({ id: row.id, name: row.name });
    }
  }
  return findCartStockIssues(cart, liveMenu, snapshot);
}
