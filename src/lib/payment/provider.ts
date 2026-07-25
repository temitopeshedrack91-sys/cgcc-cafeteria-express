// Provider interface + OPay driver. The `initialize` step in Test Mode fakes
// what the real OPay Checkout API would return: a `reference` and an
// `authorizationUrl`. In Live Mode this will call OPay's REST API. The rest of
// the app never knows which mode is active.

import type {
  InitPaymentInput,
  InitPaymentResult,
  PaymentConfig,
  PaymentResult,
  SimulatedOutcome,
} from "./types";

export interface PaymentProviderDriver {
  readonly id: "opay";
  initialize(cfg: PaymentConfig, input: InitPaymentInput): Promise<InitPaymentResult>;
  // Live mode only: verify a webhook signature. In Test Mode this is unused.
  verifyWebhookSignature(cfg: PaymentConfig, rawBody: string, signature: string): boolean;
}

function newReference(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

export const opayDriver: PaymentProviderDriver = {
  id: "opay",
  async initialize(cfg, input) {
    if (cfg.mode === "live") {
      // ------------------------------------------------------------------
      // LIVE INTEGRATION PLACEHOLDER
      // When credentials are inserted into the Payment Configuration page and
      // mode is switched to "live", replace this block with a fetch to
      // OPay's Checkout API (POST /api/v1/international/cashier/create) using
      // cfg.merchantId / cfg.publicKey / cfg.secretKey. Return the real
      // reference + cashierUrl from the response.
      // ------------------------------------------------------------------
      throw new Error(
        "OPay live credentials required. Open Admin → Payment Configuration and enter your Merchant ID, Public Key, and Secret Key.",
      );
    }
    // Test Mode: mint a simulated reference. The customer's browser drives
    // the outcome via the /payment/opay/return simulator page.
    return {
      reference: newReference("TEST-OPAY"),
      provider: "opay",
      mode: "test",
    };
  },
  verifyWebhookSignature(cfg, rawBody, signature) {
    if (cfg.mode === "test") return true;
    // Live: HMAC-SHA512 of rawBody with cfg.webhookSecret, timing-safe compare.
    // Implemented inside the server route to keep node:crypto off the client.
    return false;
  },
};

// Simulated outcome → PaymentResult mapping used only in Test Mode.
export function simulatedResult(
  outcome: SimulatedOutcome,
  reference: string,
  amount: number,
): PaymentResult {
  switch (outcome) {
    case "success":
      return { reference, status: "paid", provider: "opay", amount, meta: { simulated: true } };
    case "failed":
      return { reference, status: "failed", provider: "opay", amount, meta: { simulated: true, reason: "declined" } };
    case "cancelled":
      return { reference, status: "cancelled", provider: "opay", amount, meta: { simulated: true } };
    case "timeout":
      return { reference, status: "failed", provider: "opay", amount, meta: { simulated: true, reason: "timeout" } };
  }
}
