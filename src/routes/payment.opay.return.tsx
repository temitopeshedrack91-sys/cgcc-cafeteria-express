// OPay return / Test Mode simulator page. In LIVE mode, OPay redirects the
// customer back to this URL after payment; a webhook has usually already
// posted the true result. In TEST mode, this screen lets the customer pick
// one of the simulated outcomes so QA can exercise every branch.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, XCircle, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira, useStore, fetchOrderByCode } from "@/lib/store";
import { simulatePayment, finalizePayment } from "@/lib/payment/service";
import { loadPaymentConfig } from "@/lib/payment/config";
import type { SimulatedOutcome } from "@/lib/payment/types";
import { toast } from "sonner";

type Search = { code?: string; reference?: string; status?: string };

export const Route = createFileRoute("/payment/opay/return")({
  head: () => ({ meta: [{ title: "Confirming payment · CGCC Cafeteria Express" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    code: typeof s.code === "string" ? s.code : undefined,
    reference: typeof s.reference === "string" ? s.reference : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  component: OpayReturnPage,
});

function OpayReturnPage() {
  const navigate = useNavigate();
  const { code, reference, status } = Route.useSearch();
  const cachedOrder = useStore((s) => (code ? s.orders.find((o) => o.code === code) : undefined));
  const [mode, setMode] = useState<"test" | "live" | null>(null);
  const [busy, setBusy] = useState<SimulatedOutcome | null>(null);
  const [amount, setAmount] = useState<number>(cachedOrder?.total ?? 0);

  useEffect(() => {
    void loadPaymentConfig().then((cfg) => setMode(cfg.mode));
  }, []);

  useEffect(() => {
    if (cachedOrder) { setAmount(cachedOrder.total); return; }
    if (!code) return;
    void fetchOrderByCode(code).then((o) => { if (o) setAmount(o.total); }).catch(() => {});
  }, [code, cachedOrder]);

  // If OPay redirected with a status query (live flow), finalize immediately.
  useEffect(() => {
    if (mode !== "live" || !code || !reference || !status) return;
    const s = status === "success" ? "paid" : status === "cancelled" ? "cancelled" : "failed";
    void finalizePayment(code, {
      reference, provider: "opay", amount, status: s as never,
    }).then(() => navigate({ to: "/receipt/$code", params: { code } }))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Payment update failed"));
  }, [mode, code, reference, status, amount, navigate]);

  const outcomes = useMemo(() => ([
    { key: "success" as const, label: "Payment Successful", icon: CheckCircle2, cls: "bg-emerald-600 hover:bg-emerald-700" },
    { key: "failed" as const, label: "Payment Failed", icon: XCircle, cls: "bg-rose-600 hover:bg-rose-700" },
    { key: "cancelled" as const, label: "Payment Cancelled", icon: Ban, cls: "bg-amber-600 hover:bg-amber-700" },
    { key: "timeout" as const, label: "Payment Timeout", icon: Clock, cls: "bg-slate-600 hover:bg-slate-700" },
  ]), []);

  async function simulate(outcome: SimulatedOutcome) {
    if (!code || !reference) return;
    setBusy(outcome);
    try {
      const result = await simulatePayment(code, reference, amount, outcome);
      if (result.status === "paid") {
        toast.success("Payment successful!");
        navigate({ to: "/receipt/$code", params: { code } });
      } else {
        toast.error(`Payment ${result.status}. You can try again.`);
        setBusy(null);
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not record payment result.");
      setBusy(null);
    }
  }

  if (!code || !reference) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted-foreground">Missing payment reference.</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/checkout" })}>Back to checkout</Button>
      </div>
    );
  }

  if (mode === "live") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Confirming payment with OPay…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-center text-xs font-semibold uppercase tracking-widest text-amber-800">
        Test Mode · Simulator
      </div>
      <h1 className="mt-6 font-display text-2xl font-bold">Complete OPay payment</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Order <span className="font-semibold text-foreground">{code}</span> · {formatNaira(amount)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Reference: {reference}</p>

      <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">
        Choose an outcome to simulate
      </p>
      <div className="mt-3 grid gap-3">
        {outcomes.map((o) => (
          <Button
            key={o.key}
            size="lg"
            className={`h-14 justify-start rounded-xl text-white ${o.cls}`}
            onClick={() => simulate(o.key)}
            disabled={busy !== null}
          >
            {busy === o.key ? (
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            ) : (
              <o.icon className="mr-3 h-5 w-5" />
            )}
            {o.label}
          </Button>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        When live OPay credentials are entered in Admin → Payment Configuration
        and Mode is switched to Live, this simulator disappears and the customer
        is redirected to OPay's real checkout automatically.
      </p>
    </div>
  );
}
