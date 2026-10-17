// OPay webhook receiver. In Live Mode, OPay POSTs payment events here.
// We verify the signature, dedupe by reference (unique index on
// orders.payment_reference already enforces this at the DB level), and
// forward the result to apply_payment_result via the service-role client.
//
// In Test Mode this endpoint is unused — the browser simulator finalizes
// payments directly via apply_payment_result.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

type OpayEvent = {
  reference?: string;
  merchantOrderNo?: string; // maps to our order code
  amount?: number | string;
  status?: string; // SUCCESS | FAIL | CLOSE | PENDING
  currency?: string;
};

function normalizeStatus(s: string | undefined): "paid" | "failed" | "cancelled" | "pending" | null {
  if (!s) return null;
  const v = s.toUpperCase();
  if (v === "SUCCESS" || v === "PAID") return "paid";
  if (v === "FAIL" || v === "FAILED") return "failed";
  if (v === "CLOSE" || v === "CANCELLED" || v === "CANCELED") return "cancelled";
  if (v === "PENDING" || v === "INITIAL") return "pending";
  return null;
}

function verifySignature(secret: string, rawBody: string, signature: string): boolean {
  if (!secret || !signature) return false;
  try {
    const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/opay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature =
          request.headers.get("x-opay-signature") ??
          request.headers.get("opay-signature") ??
          "";

        // Load config + service-role client server-side.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: settings, error: cfgErr } = await supabaseAdmin
          .from("app_settings")
          .select("payment_config")
          .eq("id", "global")
          .maybeSingle();
        if (cfgErr) {
          console.error("[opay/webhook] config load failed", cfgErr);
          return new Response("Config unavailable", { status: 500 });
        }
        const cfg = (settings?.payment_config ?? {}) as {
          mode?: "test" | "live";
          provider?: string;
        };

        // Secrets live in the locked payment_secrets vault (service role only).
        const { data: secRow } = await supabaseAdmin
          .from("payment_secrets" as never)
          .select("secrets")
          .eq("id", "global")
          .maybeSingle();
        const secrets = ((secRow as { secrets?: unknown } | null)?.secrets ?? {}) as {
          credentials?: Record<string, { webhookSecret?: string }>;
          legacy?: { webhookSecret?: string };
        };

        // In live mode, require and verify the signature. In test mode, accept
        // but still require a body — the browser simulator does not call this
        // endpoint, so a POST here in test mode is an external caller.
        if (cfg.mode === "live") {
          const secret =
            secrets.credentials?.[cfg.provider ?? "opay"]?.webhookSecret ??
            secrets.legacy?.webhookSecret ??
            "";
          if (!verifySignature(secret, rawBody, signature)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let event: OpayEvent;
        try {
          event = JSON.parse(rawBody) as OpayEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const orderCode = event.merchantOrderNo;
        const reference = event.reference;
        const status = normalizeStatus(event.status);
        const amount =
          typeof event.amount === "string" ? parseInt(event.amount, 10) : event.amount ?? null;

        if (!orderCode || !reference || !status) {
          return new Response("Missing fields", { status: 400 });
        }

        const { error: rpcErr } = await supabaseAdmin.rpc("apply_payment_result", {
          _code: orderCode,
          _reference: reference,
          _status: status,
          _provider: "opay",
          _amount: amount ?? 0,
          _meta: event as unknown as never,
        });
        if (rpcErr) {
          console.error("[opay/webhook] apply_payment_result failed", rpcErr);
          return new Response(rpcErr.message, { status: 400 });
        }

        return new Response("ok");
      },
    },
  },
});
