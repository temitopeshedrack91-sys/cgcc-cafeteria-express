import { supabase } from "@/integrations/supabase/client";

export type ProductRow = {
  id: string;
  name: string;
  category_id: string | null;
  price: number;
  vendor_type: string | null;
  description: string | null;
  image_url: string | null;
  available: boolean;
  archived_at: string | null;
  stock_qty: number;
  stock_online: number;
  stock_walkin: number;
};

export async function listProducts(includeArchived = true): Promise<ProductRow[]> {
  let q = supabase
    .from("menu_items")
    .select(
      "id, name, category_id, price, vendor_type, description, image_url, available, archived_at, stock_qty, stock_online, stock_walkin",
    )
    .order("vendor_type")
    .order("name");
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any;
}

export async function upsertProduct(input: {
  id?: string;
  name: string;
  category_id?: string | null;
  price: number;
  vendor_type: string;
  description?: string | null;
  image_url?: string | null;
  available?: boolean;
}) {
  const { data, error } = await supabase.rpc("upsert_menu_item", {
    _id: input.id ?? null,
    _name: input.name,
    _category_id: input.category_id ?? null,
    _price: input.price,
    _vendor_type: input.vendor_type,
    _description: input.description ?? null,
    _image_url: input.image_url ?? null,
    _available: input.available ?? true,
  });
  if (error) throw error;
  return data as any;
}

export async function archiveProduct(id: string) {
  const { error } = await supabase.rpc("archive_menu_item", { _id: id });
  if (error) throw error;
}
export async function restoreProduct(id: string) {
  const { error } = await supabase.rpc("restore_menu_item", { _id: id });
  if (error) throw error;
}
export async function deleteProduct(id: string) {
  const { error } = await supabase.rpc("delete_menu_item", { _id: id });
  if (error) throw error;
}

export type AuditEntry = {
  id: string;
  user_id: string | null;
  user_label: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
};

export async function listAuditLog(limit = 200): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as any;
}

export async function logAudit(action: string, entity_type?: string, entity_id?: string, details: any = {}) {
  const { error } = await supabase.rpc("log_audit", {
    _action: action,
    _entity_type: entity_type ?? null,
    _entity_id: entity_id ?? null,
    _details: details,
  });
  if (error) console.warn("audit log failed", error);
}

export async function isBusinessDayClosed(day?: string): Promise<boolean> {
  const args: any = day ? { _day: day } : {};
  const { data, error } = await supabase.rpc("is_business_day_closed", args);
  if (error) return false;
  return Boolean(data);
}
