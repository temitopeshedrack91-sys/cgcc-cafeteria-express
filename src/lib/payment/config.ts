// Runtime accessor for payment config. Reads from app_settings.payment_config.
// No credentials are hardcoded — the admin Payment Configuration page fills
// this record; when live OPay keys are pasted in, no other file changes.

import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_PAYMENT_CONFIG,
  type PaymentConfig,
} from "./types";

let cached: PaymentConfig | null = null;
let inflight: Promise<PaymentConfig> | null = null;

export async function loadPaymentConfig(force = false): Promise<PaymentConfig> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("payment_config")
      .eq("id", "global")
      .maybeSingle();
    if (error) {
      console.warn("[payment] loadPaymentConfig failed", error);
      cached = { ...EMPTY_PAYMENT_CONFIG };
      return cached;
    }
    const raw = (data?.payment_config ?? {}) as Partial<PaymentConfig>;
    cached = { ...EMPTY_PAYMENT_CONFIG, ...raw };
    return cached;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export async function savePaymentConfig(next: PaymentConfig): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({
      id: "global",
      payment_config: next as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  cached = { ...next };
}

export function invalidatePaymentConfig() {
  cached = null;
}

export function isLiveReady(cfg: PaymentConfig): boolean {
  return Boolean(
    cfg.merchantId &&
      cfg.publicKey &&
      cfg.secretKey &&
      cfg.callbackUrl &&
      cfg.returnUrl,
  );
}
