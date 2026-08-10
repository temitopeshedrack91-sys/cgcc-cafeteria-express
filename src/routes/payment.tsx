import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Check, ShieldCheck, Loader2, ChevronDown, Landmark, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { actions, cartTotal, formatNaira, useStore } from "@/lib/store";
import { DEFAULT_MENU } from "@/lib/menu-data";
import { initPayment } from "@/lib/payment/service";
import { listPayableBankAccounts, type BankAccount } from "@/lib/bank-accounts";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_TRANSFER_SETTINGS,
  attachTransferProof,
  loadTransferSettings,
  uploadPaymentProof,
  type TransferSettings,
} from "@/lib/transfer-settings";
import { loadPaymentConfig } from "@/lib/payment/config";
import { providerMeta } from "@/lib/payment/types";
import { toast } from "sonner";

export const Route = createFileRoute("/payment")({
  head: () => ({ meta: [{ title: "Payment · CGCC Cafeteria Express" }] }),
  component: PaymentPage,
});

// Bank details are database-driven: Admin → Bank Transfer.
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
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bankId, setBankId] = useState<string | null>(null);
  const [transferCfg, setTransferCfg] = useState<TransferSettings>(DEFAULT_TRANSFER_SETTINGS);
  const [gatewayEnabled, setGatewayEnabled] = useState(true);
  const [gatewayName, setGatewayName] = useState("OPay");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Awaited<ReturnType<typeof actions.createOrder>> | null>(null);

  useEffect(() => {
    void (async () => {
      const [list, cfg, pay] = await Promise.all([
        listPayableBankAccounts(),
        loadTransferSettings(true),
        loadPaymentConfig(true),
      ]);
      setAccounts(list);
      setBankId(list[0]?.id ?? null);
      setTransferCfg(cfg);
      setGatewayEnabled(pay.enabled);
      setGatewayName(providerMeta(pay.provider).name);
      if (!pay.enabled && cfg.enabled) {
        setMethod("transfer");
        setShowTransfer(true);
      }
    })();
  }, []);

  const bank = accounts.find((a) => a.id === bankId) ?? null;

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
    if (!bank) return;
    try {
      await navigator.clipboard.writeText(bank.account_number);
      setCopied(true);
      toast.success("Account Number Copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Please copy manually.");
    }
  }

  /** Turns backend errors into something a customer can act on. */
  function friendlyError(e: unknown): string {
    const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
    const msg = raw.toLowerCase();
    if (msg.includes("sold out") || msg.includes("currently available") || msg.includes("not available")) {
      return raw; // stock messages from the server are already customer-friendly
    }
    if (msg.includes("pickup_time")) return "Please choose a pickup time before placing your order.";
    if (msg.includes("phone")) return "Please enter a valid phone number.";
    if (msg.includes("customer_name")) return "Please enter your name.";
    if (msg.includes("at least one item")) return "Your cart is empty. Add an item before paying.";
    if (msg.includes("closed")) return "Ordering is closed for today. Please try again tomorrow.";
    if (msg.includes("network") || msg.includes("fetch")) {
      return "Network problem. Check your connection and try again.";
    }
    return "We could not complete your order right now. Please try again in a moment.";
  }

  async function createOrderRecord() {
    // Never create a second order if one was already saved in this session.
    if (createdOrder) return createdOrder;

    if (!draft) {
      toast.error("Your checkout details are missing. Please fill the checkout form again.");
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

    if (items.length === 0) {
      toast.error("Your cart is empty. Add an item before paying.");
      navigate({ to: "/menu" });
      return null;
    }

    const order = await actions.createOrder({
      customerName: draft.name,
      phone: draft.phone,
      note: draft.note,
      orderType: draft.orderType,
      pickupTime: draft.pickupTime,
      items,
      total,
    });
    setCreatedOrder(order);
    return order;
  }

  async function payWithOpay() {
    if (submitting) return;
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
        // Live gateway checkout redirect.
        window.location.href = init.authorizationUrl;
        return;
      }

      // Test Mode: go straight to the simulator page.
      navigate({
        to: "/payment/opay/return",
        search: { code: order.code, reference: init.reference } as never,
      });
    } catch (e) {
      console.error(e);
      toast.error(friendlyError(e));
      setSubmitting(false);
    }
  }

  async function payWithTransfer() {
    if (submitting) return;
    if (!confirmed) {
      toast.error("Please tick the box to confirm you have completed the transfer.");
      return;
    }
    if (transferCfg.requireReference && !reference.trim()) {
      toast.error("Please enter the transfer reference from your bank.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Save the order FIRST — manual transfer never depends on the gateway.
      const order = await createOrderRecord();
      if (!order) { setSubmitting(false); return; }

      // 2. Best-effort: tag it as a manual transfer awaiting verification and
      //    attach any reference / proof. Failure here must not lose the order.
      try {
        let proofUrl: string | undefined;
        if (transferCfg.requireProof && proof) {
          proofUrl = await uploadPaymentProof(proof, order.code);
        }
        await attachTransferProof({
          code: order.code,
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(proofUrl ? { proofUrl } : {}),
        });
      } catch (err) {
        console.warn("[transfer] proof attach failed", err);
        toast.warning("Order saved. We could not attach your payment details — show your receipt at pickup.");
      }

      actions.clearCart();
      localStorage.removeItem("cgcc-checkout-draft");
      toast.success("Order saved. Payment will be verified shortly.");
      navigate({ to: "/receipt/$code", params: { code: order.code } });
    } catch (e) {
      console.error(e);
      toast.error(friendlyError(e));
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

      {/* PRIMARY: Online gateway */}
      {gatewayEnabled && (
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
              <p className="text-lg font-bold">Pay Online with {gatewayName}</p>
              <p className="text-xs text-muted-foreground">
                Instant confirmation · No proof upload needed
              </p>
            </div>
          </div>
          <span className="text-lg font-bold text-primary">{formatNaira(total)}</span>
        </div>
      </button>
      )}

      {gatewayEnabled && method === "opay" && (
        <Button
          size="lg"
          className="mt-4 h-14 w-full rounded-full bg-emerald-600 shadow-elegant hover:bg-emerald-700"
          onClick={payWithOpay}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          Pay {formatNaira(total)} with {gatewayName}
        </Button>
      )}

      {/* Secondary: Manual bank transfer — independent of the gateway */}
      {transferCfg.enabled && (
      <button
        type="button"
        onClick={() => { setShowTransfer((v) => !v); setMethod("transfer"); }}
        className="mt-6 flex w-full items-center justify-between rounded-xl border border-dashed border-border bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <span className="inline-flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          {gatewayEnabled ? "Pay by Bank Transfer" : "Bank Transfer"}
        </span>
        <ChevronDown className={`h-4 w-4 transition ${showTransfer ? "rotate-180" : ""}`} />
      </button>
      )}

      {transferCfg.enabled && showTransfer && (
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
            {transferCfg.instructions && (
              <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                {transferCfg.instructions}
              </p>
            )}
            {accounts.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setBankId(a.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      a.id === bankId ? "border-primary bg-primary/10 text-primary" : "border-border"
                    }`}
                  >
                    {a.logo_url && <img src={a.logo_url} alt="" className="h-4 w-4 object-contain" />}
                    {a.bank_name}
                  </button>
                ))}
              </div>
            )}
            {!bank ? (
              <p className="text-sm text-muted-foreground">
                No bank account is available right now. Please choose another payment option.
              </p>
            ) : (
            <>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Bank</p>
              <p className="text-lg font-semibold">{bank.bank_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Account name</p>
              <p className="text-lg font-semibold">{bank.account_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Account number</p>
              <div className="mt-1 flex items-center gap-3">
                <p className="font-display text-2xl font-bold tracking-wider text-primary">
                  {bank.account_number}
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
            {(bank.narration || transferCfg.narration) && (
              <p className="text-sm text-muted-foreground">{bank.narration || transferCfg.narration}</p>
            )}
            {bank.instructions && (
              <p className="text-sm text-muted-foreground">{bank.instructions}</p>
            )}
            {transferCfg.requireReference && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Transfer reference
                </p>
                <Input
                  className="mt-1"
                  placeholder="Reference from your bank app"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            )}
            {transferCfg.requireProof && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Proof of payment
                </p>
                <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold">
                  <Upload className="h-3.5 w-3.5" />
                  {proof ? proof.name : "Attach receipt (PNG, JPG or PDF)"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            )}
            </>
            )}
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
                {transferCfg.manualVerification
                  ? "An admin will verify your transfer before preparing your order."
                  : "Your order will be sent to the kitchen right away."}
              </span>
            </span>
          </label>

          <div className="p-5 pt-0">
            <Button
              size="lg"
              className="mt-4 h-14 w-full rounded-full"
              variant="secondary"
              onClick={payWithTransfer}
              disabled={submitting || !confirmed || !bank}
            >
              Continue with transfer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
