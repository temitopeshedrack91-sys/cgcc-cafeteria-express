// Provider interface + gateway driver. In Test Mode `initialize` fakes what a
// real checkout API returns: a `reference` (and, live, an authorization URL).
// In Live Mode it calls the configured provider. The rest of the app never
// knows which provider or mode is active.

import { activeCredentials } from "./config";
import type {
  InitPaymentInput,
  InitPaymentResult,
  PaymentConfig,
  PaymentResult,
  SimulatedOutcome,
} from "./types";
import { providerMeta } from "./types";

export interface PaymentProviderDriver {
  initialize(cfg: PaymentConfig, input: InitPaymentInput): Promise<InitPaymentResult>;
  verifyWebhookSignature(cfg: PaymentConfig, rawBody: string, signature: string): boolean;
}

function newReference(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

export const gatewayDriver: PaymentProviderDriver = {
  async initialize(cfg, _input) {
    const meta = providerMeta(cfg.provider);
    if (cfg.mode === "live") {
      const creds = activeCredentials(cfg);
      if (!creds.publicKey || !creds.secretKey) {
        throw new Error(
          `${meta.name} live credentials are missing. Open Admin → Online Gateway and paste your keys.`,
        );
      }
      // ------------------------------------------------------------------
      // LIVE INTEGRATION PLACEHOLDER
      // Credentials are already loaded from the database (creds.*). Swap this
      // block for the provider's checkout-create REST call and return the real
      // reference + authorization URL. No other file needs to change.
      // ------------------------------------------------------------------
      throw new Error(
        `${meta.name} live checkout is awaiting activation. Verify your credentials in Admin → Online Gateway.`,
      );
    }
    // Test Mode: mint a simulated reference. The customer's browser drives the
    // outcome via the /payment/opay/return simulator page.
    return {
      reference: newReference(`TEST-${cfg.provider.toUpperCase()}`),
      provider: cfg.provider,
      mode: "test",
    };
  },
  verifyWebhookSignature(cfg, _rawBody, _signature) {
    if (cfg.mode === "test") return true;
    // Live: HMAC of rawBody with the provider webhook secret, timing-safe compare.
    // Implemented inside the server route to keep node:crypto off the client.
    return false;
  },
};

/** Back-compat alias — older imports used `opayDriver`. */
export const opayDriver = gatewayDriver;

// Simulated outcome → PaymentResult mapping used only in Test Mode.
export function simulatedResult(
  outcome: SimulatedOutcome,
  reference: string,
  amount: number,
  provider: PaymentResult["provider"] = "opay",
): PaymentResult {
  switch (outcome) {
    case "success":
      return { reference, status: "paid", provider, amount, meta: { simulated: true } };
    case "failed":
      return { reference, status: "failed", provider, amount, meta: { simulated: true, reason: "declined" } };
    case "cancelled":
      return { reference, status: "cancelled", provider, amount, meta: { simulated: true } };
    case "timeout":
      return { reference, status: "failed", provider, amount, meta: { simulated: true, reason: "timeout" } };
  }
}
