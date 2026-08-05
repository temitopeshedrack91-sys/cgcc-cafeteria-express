// Payment integration status data for the Finance & Payment status card.
import { supabase } from "@/integrations/supabase/client";
import { getDefaultBankAccount, type BankAccount } from "@/lib/bank-accounts";
import { activeCredentials, loadPaymentConfig, isLiveReady } from "./config";
import type { PaymentConfig } from "./types";
import { providerMeta } from "./types";
import { loadTransferSettings, type TransferSettings } from "@/lib/transfer-settings";

export type Health = "healthy" | "warning" | "error";

export type PaymentTxn = {
  code: string;
  total: number;
  payment_status: string;
  payment_reference: string | null;
  payment_updated_at: string | null;
};

export type PaymentStatusSnapshot = {
  config: PaymentConfig;
  gatewayHealth: Health;
  gatewayMessage: string;
  webhookHealth: Health;
  webhookMessage: string;
  lastSuccess: PaymentTxn | null;
  lastFailed: PaymentTxn | null;
  lastSync: string | null;
  transferHealth: Health;
  transferMessage: string;
  defaultAccount: BankAccount | null;
  transfer: TransferSettings;
  providerName: string;
};

const TXN_COLS = "code, total, payment_status, payment_reference, payment_updated_at";

async function lastTxn(statuses: string[]): Promise<PaymentTxn | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(TXN_COLS)
    .in("payment_status", statuses)
    .not("payment_updated_at", "is", null)
    .order("payment_updated_at", { ascending: false })
    .limit(1);
  if (error) return null;
  return ((data ?? [])[0] as PaymentTxn) ?? null;
}

export async function loadPaymentStatus(): Promise<PaymentStatusSnapshot> {
  const config = await loadPaymentConfig(true);
  const [lastSuccess, lastFailed, defaultAccount, transfer] = await Promise.all([
    lastTxn(["paid"]),
    lastTxn(["failed", "cancelled"]),
    getDefaultBankAccount(),
    loadTransferSettings(true),
  ]);
  const creds = activeCredentials(config);
  const providerName = providerMeta(config.provider).name;

  let gatewayHealth: Health = "healthy";
  let gatewayMessage = "Test Mode simulator active — no real money moves.";
  if (!config.enabled) {
    gatewayHealth = "warning";
    gatewayMessage = "Online gateway is disabled. Customers can only pay by bank transfer.";
  } else if (config.mode === "live") {
    if (isLiveReady(config)) {
      gatewayHealth = "healthy";
      gatewayMessage = "Live credentials saved. Real payments are being accepted.";
    } else {
      gatewayHealth = "error";
      gatewayMessage =
        "Live Mode is on but credentials are incomplete. Add Merchant ID, Public Key, Secret Key, Callback URL and Return URL.";
    }
  }

  let webhookHealth: Health = "warning";
  let webhookMessage = "No callback URL configured yet.";
  if (creds.callbackUrl && creds.webhookSecret) {
    webhookHealth = "healthy";
    webhookMessage = "Callback URL and webhook secret configured.";
  } else if (creds.callbackUrl) {
    webhookHealth = config.mode === "live" ? "error" : "warning";
    webhookMessage = "Callback URL set but webhook secret is missing — signatures cannot be verified.";
  }

  let transferHealth: Health = "error";
  let transferMessage = "No active bank account. Customers cannot pay by transfer.";
  if (!transfer.enabled) {
    transferHealth = "warning";
    transferMessage = "Bank transfer is turned off for customers.";
  } else if (defaultAccount) {
    transferHealth = "healthy";
    transferMessage = `${defaultAccount.bank_name} · ${defaultAccount.account_number}`;
  }

  return {
    config,
    gatewayHealth,
    gatewayMessage,
    webhookHealth,
    webhookMessage,
    lastSuccess,
    lastFailed,
    lastSync: lastSuccess?.payment_updated_at ?? lastFailed?.payment_updated_at ?? null,
    transferHealth,
    transferMessage,
    defaultAccount,
    transfer,
    providerName,
  };
}

/** Non-destructive connection validation from the Admin Dashboard. */
export function validateGateway(cfg: PaymentConfig): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!cfg.enabled) issues.push("Gateway is disabled.");
  if (!cfg.provider) issues.push("No payment provider selected.");
  const meta = providerMeta(cfg.provider);
  const c = activeCredentials(cfg);
  if (cfg.mode === "live") {
    if (meta.usesMerchantId && !c.merchantId) issues.push(`${meta.merchantLabel} is missing.`);
    if (!c.publicKey) issues.push(`${meta.publicLabel} is missing.`);
    if (!c.secretKey) issues.push(`${meta.secretLabel} is missing.`);
    if (!c.webhookSecret) issues.push("Webhook Secret is missing.");
    if (!c.callbackUrl) issues.push("Callback URL is missing.");
    if (!c.returnUrl) issues.push("Return URL is missing.");
    if (c.callbackUrl && !/^https:\/\//.test(c.callbackUrl))
      issues.push("Callback URL must start with https://");
    if (c.returnUrl && !/^https:\/\//.test(c.returnUrl))
      issues.push("Return URL must start with https://");
  }
  if (!cfg.currency) issues.push("Currency is missing.");
  return { ok: issues.length === 0, issues };
}
