import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_MENU, type MenuItem } from "./menu-data";

export type InventoryRow = MenuItem & {
  stock_qty: number;
  low_stock_threshold: number;
  available: boolean;
  vendor_type: string | null;
};

export type InventoryHistoryRow = {
  id: string;
  menu_item_id: string;
  item_name: string;
  vendor_type: string | null;
  previous_qty: number;
  new_qty: number;
  delta: number;
  reason: string | null;
  source: string;
  changed_by_label: string | null;
  created_at: string;
};

export async function fetchInventory(scope?: string | null): Promise<InventoryRow[]> {
  let q = supabase
    .from("menu_items")
    .select("id, name, price, category_id, vendor_type, available, stock_qty, low_stock_threshold, sort_order");
  if (scope) q = q.eq("vendor_type", scope);
  const { data, error } = await q.order("sort_order").order("name");
  if (error) throw error;
  const catMap = new Map<string, string>();
  for (const m of DEFAULT_MENU) catMap.set(m.id, m.category);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    category: (catMap.get(row.id) ?? row.category_id) as any,
    image: DEFAULT_MENU.find((m) => m.id === row.id)?.image ?? "",
    stock_qty: row.stock_qty ?? 0,
    low_stock_threshold: row.low_stock_threshold ?? 10,
    available: row.available !== false,
    vendor_type: row.vendor_type ?? null,
  }));
}

export async function adjustStockRpc(
  itemId: string,
  newQty: number,
  reason?: string,
): Promise<{ ok: boolean; previous: number; new: number }> {
  const { data, error } = await supabase.rpc("adjust_stock", {
    _item_id: itemId,
    _new_qty: newQty,
    _reason: reason ?? "",
  });
  if (error) throw error;
  return data as any;
}

export async function setAvailable(itemId: string, available: boolean) {
  const { error } = await supabase.from("menu_items").update({ available }).eq("id", itemId);
  if (error) throw error;
}

export async function setLowStockThreshold(itemId: string, threshold: number) {
  const { error } = await supabase
    .from("menu_items")
    .update({ low_stock_threshold: Math.max(0, threshold) })
    .eq("id", itemId);
  if (error) throw error;
}

export async function fetchInventoryHistory(vendor?: string | null, limit = 200): Promise<InventoryHistoryRow[]> {
  const { data, error } = await supabase.rpc("list_inventory_history", {
    _limit: limit,
    _vendor: vendor ?? "",
  });
  if (error) throw error;
  return (data ?? []) as InventoryHistoryRow[];
}
