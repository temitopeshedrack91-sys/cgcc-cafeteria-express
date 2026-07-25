// Payment service layer — the only surface the app UI uses. Handles:
//   - init (create a payment session, provider-agnostic)
//   - finalize (post-webhook / post-return: mark the order paid/failed/etc.)
// The finalize call goes through the SECURITY DEFINER RPC apply_payment_result
// which enforces: amount match, reference uniqueness, and status transitions.

import { supabase } from "@/integrations/supabase/client";
import { loadPaymentConfig } from "./config";
import { opayDriver, simulatedResult } from "./provider";
import type {
  InitPaymentInput,
  InitPaymentResult,
  PaymentResult,
  SimulatedOutcome,
} from "./types";

export async function initPayment(input: InitPaymentInput): Promise<InitPaymentResult> {
  const cfg = await loadPaymentConfig();
  return opayDriver.initialize(cfg, input);
}

export async function finalizePayment(
  orderCode: string,
  result: PaymentResult,
): Promise<void> {
  const { error } = await supabase.rpc("apply_payment_result", {
    _code: orderCode,
    _reference: result.reference,
    _status: result.status,
    _provider: result.provider,
    _amount: result.amount,
    _meta: (result.meta ?? {}) as Record<string, unknown>,
  });
  if (error) throw error;
}

// Test Mode helper — used by the simulator page.
export async function simulatePayment(
  orderCode: string,
  reference: string,
  amount: number,
  outcome: SimulatedOutcome,
): Promise<PaymentResult> {
  const result = simulatedResult(outcome, reference, amount);
  await finalizePayment(orderCode, result);
  return result;
}
