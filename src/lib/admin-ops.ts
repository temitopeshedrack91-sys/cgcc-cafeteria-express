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
    _id: (input.id ?? undefined) as any,
    _name: input.name,
    _category_id: (input.category_id ?? undefined) as any,
    _price: input.price,
    _vendor_type: input.vendor_type,
    _description: (input.description ?? undefined) as any,
    _image_url: (input.image_url ?? undefined) as any,
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
export async function duplicateProduct(id: string) {
  const { data, error } = await supabase.rpc("duplicate_menu_item" as any, { _id: id });
  if (error) throw error;
  return data as any;
}

export type BulkAction = "enable" | "disable" | "archive" | "restore" | "price_set" | "price_percent";

export async function bulkUpdateProducts(ids: string[], action: BulkAction, value?: number) {
  const args: any = { _ids: ids, _action: action };
  if (value !== undefined) args._value = value;
  const { data, error } = await supabase.rpc("bulk_update_products" as any, args);
  if (error) throw error;
  return data as any;
}

export async function bulkMoveProducts(ids: string[], vendorType?: string, categoryId?: string) {
  const args: any = { _ids: ids };
  if (vendorType) args._vendor_type = vendorType;
  if (categoryId) args._category_id = categoryId;
  const { data, error } = await supabase.rpc("bulk_move_products" as any, args);
  if (error) throw error;
  return data as any;
}

/* ---------------- Categories ---------------- */

export type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
};

export async function listCategories(includeArchived = true): Promise<CategoryRow[]> {
  let q = supabase.from("categories").select("id, name, sort_order, archived_at").order("sort_order");
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any;
}

export async function upsertCategory(input: { id?: string; name: string; sort_order?: number }) {
  const args: any = { _name: input.name };
  if (input.id) args._id = input.id;
  if (input.sort_order !== undefined) args._sort_order = input.sort_order;
  const { data, error } = await supabase.rpc("upsert_category" as any, args);
  if (error) throw error;
  return data as any;
}
export async function archiveCategory(id: string) {
  const { error } = await supabase.rpc("archive_category" as any, { _id: id });
  if (error) throw error;
}
export async function restoreCategory(id: string) {
  const { error } = await supabase.rpc("restore_category" as any, { _id: id });
  if (error) throw error;
}
export async function deleteCategory(id: string) {
  const { error } = await supabase.rpc("delete_category" as any, { _id: id });
  if (error) throw error;
}
export async function reorderCategories(ids: string[]) {
  const { error } = await supabase.rpc("reorder_categories" as any, { _ids: ids });
  if (error) throw error;
}

/* ---------------- Product images ---------------- */

const IMAGE_BUCKET = "product-images";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function uploadProductImage(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, TEN_YEARS);
  if (signErr) throw signErr;
  return data.signedUrl;
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
    _entity_type: (entity_type ?? undefined) as any,
    _entity_id: (entity_id ?? undefined) as any,
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

/* ---------------- Brand logos ---------------- */

const LOGO_BUCKET = "brand-logos";
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
];
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function validateLogoFile(file: File): string | null {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const okExt = ["png", "jpg", "jpeg", "svg", "webp"].includes(ext);
  const okType = !file.type || ALLOWED_LOGO_TYPES.includes(file.type.toLowerCase());
  if (!okExt || !okType) return "Unsupported file type. Use PNG, JPG, JPEG, SVG or WebP.";
  if (file.size > MAX_LOGO_BYTES) return "Image is too large. Maximum size is 2MB.";
  return null;
}

export async function uploadLogoImage(file: File): Promise<string> {
  const invalid = validateLogoFile(file);
  if (invalid) throw new Error(invalid);
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message || "Upload failed. Please try again.");
  const { data, error: signErr } = await supabase.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw new Error("Could not generate a link for the uploaded image.");
  return data.signedUrl;
}
