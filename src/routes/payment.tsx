import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, Check, ShieldCheck, Loader2, ChevronDown, Landmark, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { actions, cartTotal, formatNaira, useStore } from "@/lib/store";
import { DEFAULT_MENU } from "@/lib/menu-data";
import { initPayment } from "@/lib/payment/service";
import { toast } from "sonner";

export const Route = createFileRoute("/payment")({
  head: () => ({ meta: [{ title: "Payment · CGCC Cafeteria Express" }] }),
  component: PaymentPage,
});

const BANK = { bank: "OPay", accountName: "Olunike Olajumoke Adewumi", accountNumber: "6104885281" };

type Method = "opay" | "transfer";

function PaymentPage() {
  const navigate = useNavigate();
  const cart = useStore((s) => s.cart);
  const total = cartTotal(cart, DEFAULT_MENU);

  const [method, setMethod] = useState<Method>("opay");
  const [showTransfer, setShowTransfer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const draft = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("cgcc-checkout-draft");
      return raw ? (JSON.parse(raw) as {
        name: string; phone: string; note?: string;
        orderType: "dine-in" | "takeaway"; pickupTime?: string;
      }) : null;
    } catch { return null; }
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(BANK.accountNumber);
      setCopied(true);
      toast.success("Account Number Copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Please copy manually.");
    }
  }

  async function createOrderRecord() {
    if (!draft) {
      toast.error("Checkout details missing. Please try again.");
      navigate({ to: "/checkout" });
      return null;
    }
    if (!draft.pickupTime) {
      toast.error("Please select your preferred pickup time before placing your order.");
      navigate({ to: "/checkout" });
      return null;
    }
    const items = cart
      .map((c) => {
        const item = DEFAULT_MENU.find((m) => m.id === c.itemId);
        if (!item) return null;
        return { id: item.id, name: item.name, price: item.price, qty: c.qty };
      })
      .filter(Boolean) as { id: string; name: string; price: number; qty: number }[];

    return actions.createOrder({
      customerName: draft.name,
      phone: draft.phone,
      note: draft.note,
      orderType: draft.orderType,
      pickupTime: draft.pickupTime,
      items,
      total,
    });
  }

  async function payWithOpay() {
    setSubmitting(true);
    try {
      const order = await createOrderRecord();
      if (!order) { setSubmitting(false); return; }

      const returnUrl = `${window.location.origin}/payment/opay/return?code=${encodeURIComponent(order.code)}`;
      const init = await initPayment({
        orderCode: order.code,
        amount: order.total,
        customerName: order.customerName,
        phone: order.phone,
        returnUrl,
      });

      actions.clearCart();
      localStorage.removeItem("cgcc-checkout-draft");

      if (init.mode === "live" && init.authorizationUrl) {
        // Live OPay checkout redirect.
        window.location.href = init.authorizationUrl;
        return;
      }

      // Test Mode: go straight to the simulator page.
      navigate({
        to: "/payment/opay/return",
        search: { code: order.code, reference: init.reference } as never,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start payment.";
      console.error(e);
      toast.error(msg);
      setSubmitting(false);
    }
  }

  async function payWithTransfer() {
    if (!confirmed) {
      toast.error("Please confirm that you have completed payment.");
      return;
    }
    setSubmitting(true);
    try {
      const order = await createOrderRecord();
      if (!order) { setSubmitting(false); return; }
      actions.clearCart();
      localStorage.removeItem("cgcc-checkout-draft");
      navigate({ to: "/receipt/$code", params: { code: order.code } });
    } catch (e) {
      console.error(e);
      toast.error("Could not save your order. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <h1 className="font-display text-3xl font-bold">Payment</h1>
      <p className="text-sm text-muted-foreground">
        Pay online in seconds — no receipt upload, no queue.
      </p>

      {/* Order summary */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Order summary</p>
        <ul className="mt-3 space-y-2 text-sm">
          {cart.map((c) => {
            const item = DEFAULT_MENU.find((m) => m.id === c.itemId);
            if (!item) return null;
            return (
              <li key={c.itemId} className="flex items-center justify-between gap-3">
                <span className="truncate">
                  <span className="font-semibold">{c.qty}×</span> {item.name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNaira(item.price * c.qty)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-dashed border-border pt-3">
          <span className="text-sm font-semibold">Grand total</span>
          <span className="text-lg font-bold text-primary">{formatNaira(total)}</span>
        </div>
      </div>

      {/* PRIMARY: OPay Online */}
      <button
        type="button"
        onClick={() => setMethod("opay")}
        className={`mt-6 w-full overflow-hidden rounded-2xl border-2 text-left shadow-elegant transition ${
          method === "opay"
            ? "border-emerald-500 ring-2 ring-emerald-200"
            : "border-border"
        }`}
      >
        <div className="flex items-center justify-between bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white">
          <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Recommended</span>
          <span>Fastest</span>
        </div>
        <div className="flex items-center justify-between gap-4 bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              🟢
            </span>
            <div>
              <p className="text-lg font-bold">Pay Online with OPay</p>
              <p className="text-xs text-muted-foreground">
                Instant confirmation · No proof upload needed
              </p>
            </div>
          </div>
          <span className="text-lg font-bold text-primary">{formatNaira(total)}</span>
        </div>
      </button>

      {method === "opay" && (
        <Button
          size="lg"
          className="mt-4 h-14 w-full rounded-full bg-emerald-600 shadow-elegant hover:bg-emerald-700"
          onClick={payWithOpay}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          Pay {formatNaira(total)} with OPay
        </Button>
      )}

      {/* Secondary: Other Payment Options */}
      <button
        type="button"
        onClick={() => { setShowTransfer((v) => !v); setMethod("transfer"); }}
        className="mt-6 flex w-full items-center justify-between rounded-xl border border-dashed border-border bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <span className="inline-flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          Other Payment Options
        </span>
        <ChevronDown className={`h-4 w-4 transition ${showTransfer ? "rotate-180" : ""}`} />
      </button>

      {showTransfer && (
        <div
          className={`mt-3 overflow-hidden rounded-2xl border ${
            method === "transfer" ? "border-border" : "border-border/60"
          } bg-card shadow-soft`}
        >
          <div className="bg-primary p-5 text-primary-foreground">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-brand">
              <ShieldCheck className="h-4 w-4" />
              Bank transfer (backup)
            </div>
            <p className="mt-2 text-3xl font-bold">{formatNaira(total)}</p>
            <p className="text-sm text-primary-foreground/70">Amount to transfer</p>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Bank</p>
              <p className="text-lg font-semibold">{BANK.bank}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Account name</p>
              <p className="text-lg font-semibold">{BANK.accountName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Account number</p>
              <div className="mt-1 flex items-center gap-3">
                <p className="font-display text-2xl font-bold tracking-wider text-primary">
                  {BANK.accountNumber}
                </p>
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-brand/20"
                  aria-label="Copy account number"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 border-t border-border bg-muted/40 p-4">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(Boolean(v))}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-semibold">I have completed the transfer.</span>
              <br />
              <span className="text-muted-foreground">
                An admin will verify your transfer before preparing your order.
              </span>
            </span>
          </label>

          <div className="p-5 pt-0">
            <Button
              size="lg"
              className="mt-4 h-14 w-full rounded-full"
              variant="secondary"
              onClick={payWithTransfer}
              disabled={submitting || !confirmed}
            >
              Continue with transfer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
