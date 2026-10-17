import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_MENU, type MenuItem } from "./menu-data";

export type InventoryRow = MenuItem & {
  stock_qty: number;
  stock_online: number;
  stock_walkin: number;
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
    .select(
      "id, name, price, category_id, vendor_type, available, stock_qty, stock_online, stock_walkin, low_stock_threshold, sort_order",
    );
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
    stock_online: row.stock_online ?? 0,
    stock_walkin: row.stock_walkin ?? 0,
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
  const args: { _item_id: string; _new_qty: number; _reason?: string } = {
    _item_id: itemId,
    _new_qty: newQty,
  };
  if (reason) args._reason = reason;
  const { data, error } = await supabase.rpc("adjust_stock", args);
  if (error) throw error;
  return data as any;
}

export async function adjustStockSplitRpc(
  itemId: string,
  online: number,
  walkin: number,
  reason?: string,
) {
  const args: any = { _item_id: itemId, _online: online, _walkin: walkin };
  if (reason) args._reason = reason;
  const { data, error } = await supabase.rpc("adjust_stock_split", args);
  if (error) throw error;
  return data as any;
}

export async function reallocateStockRpc(
  itemId: string,
  deltaToOnline: number,
  reason?: string,
) {
  const args: any = { _item_id: itemId, _delta_to_online: deltaToOnline };
  if (reason) args._reason = reason;
  const { data, error } = await supabase.rpc("reallocate_stock", args);
  if (error) throw error;
  return data as any;
}

export async function setAvailable(itemId: string, available: boolean) {
  const { error } = await supabase.rpc("vendor_set_item_availability", {
    _id: itemId,
    _available: available,
  });
  if (error) throw error;
}

export async function setLowStockThreshold(itemId: string, threshold: number) {
  const { error } = await supabase.rpc("vendor_set_low_stock_threshold", {
    _id: itemId,
    _threshold: Math.max(0, threshold),
  });
  if (error) throw error;
}

export async function fetchInventoryHistory(vendor?: string | null, limit = 200): Promise<InventoryHistoryRow[]> {
  const args: { _limit?: number; _vendor?: string } = { _limit: limit };
  if (vendor) args._vendor = vendor;
  const { data, error } = await supabase.rpc("list_inventory_history", args);
  if (error) throw error;
  return (data ?? []) as InventoryHistoryRow[];
}
