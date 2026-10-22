// Runtime accessor for the ONLINE PAYMENT GATEWAY config only.
// Manual bank transfer lives in src/lib/transfer-settings.ts and is fully
// independent of this file. Credentials come from app_settings.payment_config,
// filled in from Admin → Online Gateway. Nothing is hardcoded.

import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_CREDENTIALS,
  EMPTY_PAYMENT_CONFIG,
  type GatewayProviderId,
  type PaymentConfig,
  type ProviderCredentials,
} from "./types";

let cached: PaymentConfig | null = null;
let inflight: Promise<PaymentConfig> | null = null;

/** Credentials for the currently selected provider (with legacy fallback). */
export function activeCredentials(cfg: PaymentConfig): ProviderCredentials {
  const saved = cfg.credentials?.[cfg.provider];
  if (saved) return { ...EMPTY_CREDENTIALS, ...saved };
  // Legacy flat record — treat as the current provider's credentials.
  return {
    merchantId: cfg.merchantId ?? "",
    publicKey: cfg.publicKey ?? "",
    secretKey: cfg.secretKey ?? "",
    webhookSecret: cfg.webhookSecret ?? "",
    callbackUrl: cfg.callbackUrl ?? "",
    returnUrl: cfg.returnUrl ?? "",
  };
}

export function withCredentials(
  cfg: PaymentConfig,
  provider: GatewayProviderId,
  creds: ProviderCredentials,
): PaymentConfig {
  return { ...cfg, credentials: { ...(cfg.credentials ?? {}), [provider]: creds } };
}

function normalize(raw: Partial<PaymentConfig>): PaymentConfig {
  const cfg: PaymentConfig = {
    ...EMPTY_PAYMENT_CONFIG,
    ...raw,
    credentials: { ...(raw.credentials ?? {}) },
  };
  // Migrate a legacy flat record into the per-provider map on first read.
  if (!cfg.credentials[cfg.provider] && (raw.merchantId || raw.publicKey || raw.secretKey)) {
    cfg.credentials[cfg.provider] = {
      merchantId: raw.merchantId ?? "",
      publicKey: raw.publicKey ?? "",
      secretKey: raw.secretKey ?? "",
      webhookSecret: raw.webhookSecret ?? "",
      callbackUrl: raw.callbackUrl ?? "",
      returnUrl: raw.returnUrl ?? "",
    };
  }
  return cfg;
}

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
    const cfg = normalize((data?.payment_config ?? {}) as Partial<PaymentConfig>);
    // Credentials live in the locked payment_secrets vault — only admins can
    // read them (via the admin-only RPC). Non-admins get an empty set.
    try {
      const { data: secrets } = await supabase.rpc("get_payment_secrets");
      const s = (secrets ?? {}) as {
        credentials?: PaymentConfig["credentials"];
        legacy?: Partial<ProviderCredentials>;
      };
      if (s.credentials) cfg.credentials = { ...s.credentials };
      const active = cfg.credentials?.[cfg.provider];
      if (!active && s.legacy && (s.legacy.secretKey || s.legacy.publicKey)) {
        cfg.credentials = {
          ...(cfg.credentials ?? {}),
          [cfg.provider]: { ...EMPTY_CREDENTIALS, ...s.legacy },
        };
      }
    } catch {
      // Not an admin — credentials intentionally unavailable.
    }
    cached = cfg;
    return cached;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export async function savePaymentConfig(next: PaymentConfig): Promise<void> {
  if (next.mode === 'live') throw new Error('Live payments are not activated. Provider verification and end-to-end tests are required first.');
  // Split: credentials go to the locked vault, everything else stays in
  // the publicly readable app_settings row.
  const { credentials, secretKey, webhookSecret, merchantId, publicKey, ...publicPart } = next;
  const { error: secErr } = await supabase.rpc("save_payment_secrets", {
    _data: { credentials: credentials ?? {} } as unknown as never,
  });
  if (secErr) throw secErr;
  const { error } = await supabase
    .from("app_settings")
    .upsert({
      id: "global",
      payment_config: publicPart as unknown as never,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  cached = { ...next };
}

export function invalidatePaymentConfig() {
  cached = null;
}

/** True when the selected provider has everything needed for Live Mode. */
export function isLiveReady(cfg: PaymentConfig): boolean {
  const c = activeCredentials(cfg);
  return Boolean(c.publicKey && c.secretKey && c.callbackUrl && c.returnUrl);
}
