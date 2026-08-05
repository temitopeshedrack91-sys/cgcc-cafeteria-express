// Manual bank transfer accounts — fully admin-managed from Admin → Bank Transfer.
import { supabase } from "@/integrations/supabase/client";

export type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  enabled: boolean;
  is_default: boolean;
  archived_at: string | null;
  logo_url: string | null;
  instructions: string | null;
  narration: string | null;
  sort_order: number;
};

const COLS =
  "id, bank_name, account_name, account_number, enabled, is_default, archived_at, logo_url, instructions, narration, sort_order";

export async function listBankAccounts(includeArchived = true): Promise<BankAccount[]> {
  let q = supabase.from("bank_accounts").select(COLS).order("sort_order").order("created_at");
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as BankAccount[];
}

/** The account customers should transfer to. */
export async function getDefaultBankAccount(): Promise<BankAccount | null> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select(COLS)
    .eq("enabled", true)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("sort_order")
    .limit(1);
  if (error) {
    console.warn("[bank-accounts] load failed", error);
    return null;
  }
  return ((data ?? [])[0] as unknown as BankAccount) ?? null;
}

/** Every account a customer may transfer to, in display order. */
export async function listPayableBankAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select(COLS)
    .eq("enabled", true)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("sort_order");
  if (error) {
    console.warn("[bank-accounts] load failed", error);
    return [];
  }
  return (data ?? []) as unknown as BankAccount[];
}

export async function saveBankAccount(input: {
  id?: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  enabled?: boolean;
  logo_url?: string | null;
  instructions?: string | null;
  narration?: string | null;
}) {
  const payload: Record<string, unknown> = {
    bank_name: input.bank_name.trim(),
    account_name: input.account_name.trim(),
    account_number: input.account_number.trim(),
    enabled: input.enabled ?? true,
    logo_url: input.logo_url ?? null,
    instructions: input.instructions?.trim() || null,
    narration: input.narration?.trim() || null,
  };
  if (input.id) {
    const { error } = await supabase
      .from("bank_accounts")
      .update(payload as never)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("bank_accounts").insert(payload as never);
    if (error) throw error;
  }
}

export async function setBankAccountEnabled(id: string, enabled: boolean) {
  const { error } = await supabase.from("bank_accounts").update({ enabled }).eq("id", id);
  if (error) throw error;
}

export async function setBankAccountArchived(id: string, archived: boolean) {
  const { error } = await supabase
    .from("bank_accounts")
    .update({ archived_at: archived ? new Date().toISOString() : null, ...(archived ? { is_default: false } : {}) })
    .eq("id", id);
  if (error) throw error;
}

export async function setDefaultBankAccount(id: string) {
  const { error: clearErr } = await supabase
    .from("bank_accounts")
    .update({ is_default: false })
    .neq("id", id);
  if (clearErr) throw clearErr;
  const { error } = await supabase
    .from("bank_accounts")
    .update({ is_default: true, enabled: true, archived_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function reorderBankAccounts(ids: string[]) {
  const { error } = await (supabase.rpc as any)("reorder_bank_accounts", { _ids: ids });
  if (error) throw error;
}

export async function deleteBankAccount(id: string) {
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) throw error;
}
