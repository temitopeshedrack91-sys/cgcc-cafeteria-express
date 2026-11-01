// Online payment return / Test Mode simulator page. In LIVE mode the active
// provider redirects the customer back here after payment; a webhook has usually already
// posted the true result. In TEST mode, this screen lets the customer pick
// one of the simulated outcomes so QA can exercise every branch.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, XCircle, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira, useStore, fetchOrderByCode } from "@/lib/store";
import { simulatePayment } from "@/lib/payment/service";
import { loadPaymentConfig } from "@/lib/payment/config";
import type { GatewayProviderId, SimulatedOutcome } from "@/lib/payment/types";
import { toast } from "sonner";

type Search = { code?: string; reference?: string; status?: string };

export const Route = createFileRoute("/payment_/opay/return")({
  head: () => ({ meta: [
    { title: 'Payment result · CGCC Cafeteria Express' },
    { name: 'description', content: 'Check the saved payment status of your CGCC order.' },
    { property: 'og:title', content: 'Payment result · CGCC Cafeteria Express' },
    { property: 'og:description', content: 'Check the saved payment status of your CGCC order.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
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
  const [provider, setProvider] = useState<GatewayProviderId>("opay");

  useEffect(() => {
    void loadPaymentConfig().then((cfg) => { setMode(cfg.mode); setProvider(cfg.provider); });
  }, []);

  useEffect(() => {
    if (cachedOrder) { setAmount(cachedOrder.total); return; }
    if (!code) return;
    void fetchOrderByCode(code).then((o) => { if (o) setAmount(o.total); }).catch(() => {});
  }, [code, cachedOrder]);

  // A redirect query is untrusted. Only read the saved status; never settle here.
  useEffect(() => {
    if (mode !== 'live' || !code) return;
    void fetchOrderByCode(code).then(() => navigate({ to: '/receipt/$code', params: { code } }))
      .catch(() => toast.error('Could not check payment. Please try again.'));
  }, [mode, code, navigate]);

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
        toast.info("Simulation completed. No payment was collected; your order remains pending verification.");
        navigate({ to: "/receipt/$code", params: { code } });
      } else {
        toast.info(`Simulated ${result.status}. Your saved order has not changed.`);
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
        <p className="mt-4 text-sm text-muted-foreground">Confirming your payment…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-center text-xs font-semibold uppercase tracking-widest text-amber-800">
        Test Mode · Simulator
      </div>
      <h1 className="mt-6 font-display text-2xl font-bold">Complete your online payment</h1>
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
        Test results do not confirm real payments. Payment remains pending until verified.
      </p>
    </div>
  );
}
