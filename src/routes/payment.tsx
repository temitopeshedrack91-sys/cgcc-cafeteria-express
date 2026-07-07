import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { actions, cartTotal, formatNaira, useStore } from "@/lib/store";
import { DEFAULT_MENU } from "@/lib/menu-data";
import { toast } from "sonner";

export const Route = createFileRoute("/payment")({
  head: () => ({ meta: [{ title: "Payment · CGCC Cafeteria Express" }] }),
  component: PaymentPage,
});

const BANK = { bank: "OPay", accountName: "Olunike Olajumoke Adewumi", accountNumber: "6104885281" };

function PaymentPage() {
  const navigate = useNavigate();
  const cart = useStore((s) => s.cart);
  const total = cartTotal(cart, DEFAULT_MENU);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(BANK.accountNumber);
      setCopied(true);
      toast.success("Account Number Copied Successfully.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Please copy manually.");
    }
  }

  function confirm() {
    if (!confirmed) {
      toast.error("Please confirm that you have completed payment.");
      return;
    }
    const draftRaw = localStorage.getItem("cgcc-checkout-draft");
    if (!draftRaw) {
      toast.error("Checkout details missing. Please try again.");
      navigate({ to: "/checkout" });
      return;
    }
    const draft = JSON.parse(draftRaw) as {
      name: string;
      phone: string;
      note?: string;
      orderType: "dine-in" | "takeaway";
    };
    setSubmitting(true);
    const items = cart
      .map((c) => {
        const item = DEFAULT_MENU.find((m) => m.id === c.itemId);
        if (!item) return null;
        return { id: item.id, name: item.name, price: item.price, qty: c.qty };
      })
      .filter(Boolean) as { id: string; name: string; price: number; qty: number }[];

    const order = actions.createOrder({
      customerName: draft.name,
      phone: draft.phone,
      note: draft.note,
      orderType: draft.orderType,
      items,
      total,
    });
    actions.clearCart();
    localStorage.removeItem("cgcc-checkout-draft");
    navigate({ to: "/receipt/$code", params: { code: order.code } });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <h1 className="font-display text-3xl font-bold">Payment</h1>
      <p className="text-sm text-muted-foreground">
        Transfer the exact amount to the account below.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
        <div className="bg-primary p-5 text-primary-foreground">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-brand">
            <ShieldCheck className="h-4 w-4" />
            Bank transfer
          </div>
          <p className="mt-2 text-3xl font-bold">{formatNaira(total)}</p>
          <p className="text-sm text-primary-foreground/70">Amount to pay</p>
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
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(v) => setConfirmed(Boolean(v))}
          className="mt-0.5"
        />
        <span className="text-sm">
          <span className="font-semibold">I have completed payment.</span>
          <br />
          <span className="text-muted-foreground">
            An admin will verify your transfer before preparing your order.
          </span>
        </span>
      </label>

      <Button
        size="lg"
        className="mt-6 h-14 w-full rounded-full shadow-elegant"
        onClick={confirm}
        disabled={submitting}
      >
        Confirm Payment
      </Button>
    </div>
  );
}
