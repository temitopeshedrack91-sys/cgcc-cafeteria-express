// Manual bank transfer settings — completely independent of the online
// payment gateway. Stored in app_settings.transfer_config and fully editable
// from Admin → Bank Transfer.

import { supabase } from "@/integrations/supabase/client";

export type TransferSettings = {
  enabled: boolean;
  instructions: string;
  narration: string;
  requireProof: boolean;
  requireReference: boolean;
  manualVerification: boolean;
};

export const DEFAULT_TRANSFER_SETTINGS: TransferSettings = {
  enabled: true,
  instructions:
    "Transfer the exact total to the account below, then tap Continue. Your order is confirmed once payment is verified.",
  narration: "Use your Order Code as the transfer narration/remark.",
  requireProof: false,
  requireReference: false,
  manualVerification: true,
};

let cached: TransferSettings | null = null;

export async function loadTransferSettings(force = false): Promise<TransferSettings> {
  if (!force && cached) return cached;
  const { data, error } = await supabase
    .from("app_settings")
    .select("transfer_config")
    .eq("id", "global")
    .maybeSingle();
  if (error) {
    console.warn("[transfer] load failed", error);
    cached = { ...DEFAULT_TRANSFER_SETTINGS };
    return cached;
  }
  const raw = ((data as any)?.transfer_config ?? {}) as Partial<TransferSettings>;
  cached = { ...DEFAULT_TRANSFER_SETTINGS, ...raw };
  return cached;
}

export async function saveTransferSettings(next: TransferSettings): Promise<void> {
  const { error } = await (supabase.rpc as any)("save_transfer_config", { _data: next });
  if (error) throw error;
  cached = { ...next };
}

export function invalidateTransferSettings() {
  cached = null;
}

/** Attach a customer's transfer reference / proof of payment to an order. */
export async function attachTransferProof(input: {
  code: string;
  reference?: string;
  proofUrl?: string;
}) {
  const { error } = await (supabase.rpc as any)("attach_transfer_proof", {
    _code: input.code,
    _reference: input.reference ?? null,
    _proof_url: input.proofUrl ?? null,
  });
  if (error) throw error;
}

const PROOF_BUCKET = "payment-proofs";
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export async function uploadPaymentProof(file: File, orderCode: string): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  if (!["png", "jpg", "jpeg", "webp", "pdf"].includes(ext)) {
    throw new Error("Unsupported file. Upload a PNG, JPG, WebP or PDF.");
  }
  if (file.size > MAX_PROOF_BYTES) throw new Error("File is too large. Maximum size is 5MB.");
  const path = `${orderCode}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message || "Upload failed. Please try again.");
  return path;
}
