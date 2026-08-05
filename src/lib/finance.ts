// Finance security client wrappers. All verification happens server-side in
// SECURITY DEFINER RPCs; the browser never sees the PIN hash.
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "cgcc-finance-session";

export type FinanceStatus = {
  configured: boolean;
  otp_enabled: boolean;
  recovery_email: string | null;
  timeout_minutes: number;
  failed_attempts: number;
  locked_until: string | null;
};

export type UnlockResult = {
  ok: boolean;
  session_id?: string;
  needs_otp?: boolean;
  otp_code?: string;
  recovery_email?: string;
  locked_until?: string;
  attempts_left?: number;
};

export async function financeStatus(): Promise<FinanceStatus> {
  const { data, error } = await supabase.rpc("finance_status");
  if (error) throw error;
  return data as unknown as FinanceStatus;
}

export async function financeSetup(pin: string, email: string, otpEnabled: boolean) {
  const { error } = await supabase.rpc("finance_setup", {
    _pin: pin,
    _email: email,
    _otp_enabled: otpEnabled,
  });
  if (error) throw error;
}

export async function financeUnlock(pin: string): Promise<UnlockResult> {
  const { data, error } = await supabase.rpc("finance_unlock", { _pin: pin });
  if (error) throw error;
  return data as unknown as UnlockResult;
}

export async function financeVerifyOtp(sessionId: string, code: string) {
  const { data, error } = await supabase.rpc("finance_verify_otp", {
    _session_id: sessionId,
    _code: code,
  });
  if (error) throw error;
  return data as unknown as { ok: boolean; reason?: string };
}

export async function financeSessionValid(sessionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("finance_session_valid", { _session_id: sessionId });
  if (error) return false;
  return Boolean(data);
}

export async function financeChangePin(current: string, next: string) {
  const { error } = await supabase.rpc("finance_change_pin", { _current: current, _new: next });
  if (error) throw error;
}

export async function financeUpdateSettings(input: {
  recoveryEmail?: string | null;
  otpEnabled?: boolean | null;
  timeoutMinutes?: number | null;
}) {
  const { error } = await supabase.rpc("finance_update_settings", {
    _recovery_email: (input.recoveryEmail ?? null) as never,
    _otp_enabled: (input.otpEnabled ?? null) as never,
    _timeout_minutes: (input.timeoutMinutes ?? null) as never,
  });
  if (error) throw error;
}

export async function financeLogoutAll() {
  const { error } = await supabase.rpc("finance_logout_all");
  if (error) throw error;
  clearFinanceSession();
}

export type FinanceEvent = {
  id: string;
  user_label: string | null;
  event: string;
  success: boolean;
  detail: string | null;
  created_at: string;
};

export async function listFinanceEvents(limit = 50): Promise<FinanceEvent[]> {
  const { data, error } = await supabase
    .from("finance_login_events")
    .select("id, user_label, event, success, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as FinanceEvent[];
}

export type FinanceSession = {
  id: string;
  user_label: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export async function listActiveFinanceSessions(): Promise<FinanceSession[]> {
  const { data, error } = await supabase
    .from("finance_sessions")
    .select("id, user_label, created_at, last_seen_at, expires_at, revoked_at")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("last_seen_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinanceSession[];
}

export function storeFinanceSession(id: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* ignore */
  }
}
export function readFinanceSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
export function clearFinanceSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
