import { supabase } from "@/integrations/supabase/client";

export type CashierPaymentMethod = "cash" | "pos" | "transfer" | "opay";

export type CashierSaleItem = {
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
  vendor_type: string | null;
};

export type CashierSale = {
  id: string;
  code: string;
  receipt_no: string;
  cashier_id: string;
  cashier_label: string | null;
  customer_name: string | null;
  payment_method: CashierPaymentMethod;
  note: string | null;
  total: number;
  created_at: string;
  items: CashierSaleItem[];
};

export async function createCashierSale(input: {
  payment_method: CashierPaymentMethod;
  customer_name?: string;
  note?: string;
  items: { id: string; qty: number }[];
}): Promise<CashierSale> {
  const { data, error } = await supabase.rpc("create_cashier_sale", {
    _payment_method: input.payment_method,
    _customer_name: input.customer_name ?? "",
    _note: input.note ?? "",
    _items: input.items,
  });
  if (error) throw error;
  const row = data as any;
  return {
    id: row.id,
    code: row.code,
    receipt_no: row.receipt_no,
    cashier_id: "",
    cashier_label: null,
    customer_name: row.customer_name ?? null,
    payment_method: row.payment_method,
    note: null,
    total: row.total,
    created_at: row.created_at,
    items: row.items ?? [],
  };
}

export async function listCashierSales(limit = 200): Promise<CashierSale[]> {
  const { data, error } = await supabase
    .from("cashier_sales")
    .select(
      "id, code, receipt_no, cashier_id, cashier_label, customer_name, payment_method, note, total, created_at, cashier_sale_items ( menu_item_id, name, price, qty, vendor_type )",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    code: r.code,
    receipt_no: r.receipt_no,
    cashier_id: r.cashier_id,
    cashier_label: r.cashier_label,
    customer_name: r.customer_name,
    payment_method: r.payment_method,
    note: r.note,
    total: r.total,
    created_at: r.created_at,
    items: r.cashier_sale_items ?? [],
  }));
}

export function paymentLabel(m: CashierPaymentMethod): string {
  return { cash: "Cash", pos: "POS / Card", transfer: "Bank Transfer", opay: "OPay Online" }[m];
}
