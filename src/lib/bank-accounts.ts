// Manual bank transfer accounts — fully admin-managed from Finance & Payment.
import { supabase } from "@/integrations/supabase/client";

export type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  enabled: boolean;
  is_default: boolean;
  archived_at: string | null;
};

const COLS = "id, bank_name, account_name, account_number, enabled, is_default, archived_at";

export async function listBankAccounts(includeArchived = true): Promise<BankAccount[]> {
  let q = supabase.from("bank_accounts").select(COLS).order("created_at");
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BankAccount[];
}

/** The account customers should transfer to. */
export async function getDefaultBankAccount(): Promise<BankAccount | null> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select(COLS)
    .eq("enabled", true)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("created_at")
    .limit(1);
  if (error) {
    console.warn("[bank-accounts] load failed", error);
    return null;
  }
  return ((data ?? [])[0] as BankAccount) ?? null;
}

export async function saveBankAccount(input: {
  id?: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  enabled?: boolean;
}) {
  const payload = {
    bank_name: input.bank_name.trim(),
    account_name: input.account_name.trim(),
    account_number: input.account_number.trim(),
    enabled: input.enabled ?? true,
  };
  if (input.id) {
    const { error } = await supabase.from("bank_accounts").update(payload).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("bank_accounts").insert(payload);
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

export async function deleteBankAccount(id: string) {
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) throw error;
}
