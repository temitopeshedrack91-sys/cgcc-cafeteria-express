import { pageMeta } from "@/lib/page-meta";
import { useSystemSettings } from "@/lib/settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, MessageCircle, CheckCircle2, Clock, Loader2, RefreshCw, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { formatNaira, useStore, fetchOrderByCode, type Order } from "@/lib/store";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { rememberOrder } from "@/lib/history";
import { toQrDataUrl } from "@/lib/qr";
import {
  buildTimeline,
  pickupLabel,
  pickupTone,
  paymentTone,
  toneClasses,
} from "@/lib/order-status";
import { toast } from "sonner";

const WHATSAPP_NUMBER = "09134749319";
const REFRESH_INTERVAL_MS = 8000;

export const Route = createFileRoute("/receipt/$code")({
  head: ({ params }) => ({ meta: [...pageMeta(`Receipt ${params.code} · CGCC Cafeteria Express`, "View your CGCC order receipt and saved payment status.")] }),
  component: ReceiptPage,
});

function ReceiptPage() {
  useSystemSettings();
  const { code } = Route.useParams();
  const cached = useStore((s) => s.orders.find((o) => o.code === code));
  const [order, setOrder] = useState<Order | null>(cached ?? null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">(
    cached ? "ready" : "loading",
  );
  const [refreshing, setRefreshing] = useState(false);
  const [notifyOn, setNotifyOn] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const mounted = useRef(true);
  const prevPickup = useRef<string | null>(cached?.pickupStatus ?? null);
  const prevPayment = useRef<string | null>(cached?.paymentStatus ?? null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/receipt/${code}`;
    void toQrDataUrl(url).then((d) => setQr(d)).catch(() => setQr(null));
  }, [code]);

  useEffect(() => {
    mounted.current = true;
    rememberOrder(code);
    if (typeof Notification !== "undefined") {
      setNotifyOn(Notification.permission === "granted");
    }
    return () => {
      mounted.current = false;
    };
  }, [code]);

  function notify(title: string, body: string) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, { body });
        return;
      } catch {
        // fall through to toast
      }
    }
    toast(title, { description: body });
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      toast.error("Notifications not supported on this device.");
      return;
    }
    const res = await Notification.requestPermission();
    setNotifyOn(res === "granted");
    if (res !== "granted") toast("Notifications blocked", { description: "You'll still see in-app alerts." });
  }

  async function load(isBackground = false) {
    if (isBackground) setRefreshing(true);
    try {
      const fresh = await fetchOrderByCode(code);
      if (!mounted.current) return;
      if (fresh) {
        // detect status transitions and notify
        if (prevPickup.current && prevPickup.current !== fresh.pickupStatus) {
          notify(`Order ${fresh.code}`, pickupLabel(fresh.pickupStatus));
        }
        if (
          prevPayment.current &&
          prevPayment.current !== fresh.paymentStatus &&
          fresh.paymentStatus === "paid"
        ) {
          notify(`Order ${fresh.code}`, "Payment confirmed by the cafeteria.");
        }
        prevPickup.current = fresh.pickupStatus;
        prevPayment.current = fresh.paymentStatus;

        setOrder(fresh);
        setStatus("ready");
      } else if (!order) {
        setStatus("not-found");
      }
    } catch (e) {
      console.error("[receipt] load failed", e);
      if (!mounted.current) return;
      if (!order) setStatus("error");
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }

  useEffect(() => {
    load(!!cached);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, REFRESH_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading receipt…</p>
        <Button
          variant="ghost"
          className="mt-6"
          onClick={() => {
            setStatus("loading");
            load();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (status === "error" && !order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Couldn't load receipt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button
            onClick={() => {
              setStatus("loading");
              load();
            }}
            className="rounded-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
          <Button asChild variant="secondary" className="rounded-full">
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "not-found" || !order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Receipt not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This order code doesn't exist.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  async function downloadPdf() {
    if (!order) return;
    try {
      await downloadReceiptPdf(order);
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    }
  }

  function whatsapp() {
    if (!order) return;
    const shareUrl = `${window.location.origin}/receipt/${order.code}`;
    const msg =
      `Hello CGCC Cafeteria,\n\n` +
      `My name is ${order.customerName}.\n\n` +
      `I have completed payment.\n\n` +
      `Order Code:\n${order.code}\n\n` +
      `Receipt Number:\n${order.receiptNo}\n\n` +
      `Total:\n${formatNaira(order.total)}\n\n` +
      `Receipt link:\n${shareUrl}\n\n` +
      `Kindly confirm my payment and prepare my order.\n\n` +
      `Thank you.`;
    const digits = WHATSAPP_NUMBER.replace(/\D/g, "");
    const intl = digits.startsWith("0") ? "234" + digits.slice(1) : digits;
    const url = `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  const created = new Date(order.createdAt);
  const timeline = buildTimeline(order);
  const pTone = pickupTone(order.pickupStatus);
  const payTone = paymentTone(order.paymentStatus);

  return (
    <div className="mx-auto max-w-md px-4 py-6 pb-16">
      <div className="mb-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
        <h1 className="mt-2 font-display text-2xl font-bold">Order Confirmed</h1>
        <p className="text-sm text-muted-foreground">Show this code at the cafeteria counter.</p>
        {refreshing && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Updating…
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
        <div className="bg-primary p-6 text-center text-primary-foreground">
          <Logo className="mx-auto h-10 w-auto brightness-0 invert-0" />
          <p className="mt-3 text-xs uppercase tracking-widest text-brand">Order Code</p>
          <p className="font-display text-5xl font-black tracking-wider">{order.code}</p>
          <p className="mt-2 text-xs text-primary-foreground/70">Receipt · {order.receiptNo}</p>
        </div>

        {qr && (
          <div className="flex flex-col items-center gap-2 border-b border-border bg-white px-6 py-5">
            <img
              src={qr}
              alt={`QR code for receipt ${order.code}`}
              className="h-40 w-40 rounded-lg border border-border"
            />
            <p className="text-xs text-muted-foreground">
              Scan to open this receipt on another device
            </p>
          </div>
        )}



        <div className="space-y-4 p-6">
          {/* Timeline */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order Progress
            </p>
            <ol className="space-y-2.5">
              {timeline.map((step) => (
                <li key={step.key} className="flex items-center gap-3">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      step.done
                        ? "bg-emerald-500 text-white"
                        : step.active
                          ? "bg-amber-400 text-amber-950 ring-2 ring-amber-200"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.done ? "✓" : ""}
                  </span>
                  <span
                    className={`text-sm ${
                      step.done
                        ? "font-semibold text-foreground"
                        : step.active
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Customer</p>
              <p className="font-semibold">{order.customerName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Phone</p>
              <p className="font-semibold">{order.phone}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Order type</p>
              <p className="font-semibold capitalize">{order.orderType}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Placed</p>
              <p className="font-semibold">
                {created.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {created.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="col-span-2 rounded-lg bg-brand/5 p-3">
              <p className="text-xs uppercase text-muted-foreground">Your pickup time</p>
              <p className="font-semibold">
                {order.pickupTime ?? "Not set"}
                <span className="ml-1 text-xs font-normal text-muted-foreground">(chosen at checkout)</span>
              </p>
            </div>
          </div>


          {order.note && (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <span className="font-semibold">Note: </span>
              {order.note}
            </div>
          )}

          <div className="border-t border-dashed border-border pt-4">
            <p className="text-xs uppercase text-muted-foreground">Items</p>
            <ul className="mt-2 space-y-2 text-sm">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    <span className="font-semibold">{i.qty}×</span> {i.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatNaira(i.price * i.qty)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-between border-t border-dashed border-border pt-4">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">{formatNaira(order.total)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg p-3 text-center ${toneClasses[payTone]}`}>
              <p className="text-[10px] uppercase tracking-wider opacity-80">Payment</p>
              <p className="mt-0.5 text-sm font-bold uppercase">
                {order.paymentStatus === "paid" ? "Paid" : "Pending"}
              </p>
            </div>
            <div className={`rounded-lg p-3 text-center ${toneClasses[pTone]}`}>
              <p className="text-[10px] uppercase tracking-wider opacity-80">Pickup</p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-sm font-bold uppercase">
                <Clock className="h-3 w-3" />
                {pickupLabel(order.pickupStatus)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {!notifyOn && (
        <button
          onClick={enableNotifications}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-brand hover:text-primary"
        >
          <Bell className="h-3.5 w-3.5" />
          Get notified when your order is ready
        </button>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={downloadPdf} className="h-12 rounded-full">
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
        <Button onClick={whatsapp} className="h-12 rounded-full bg-[#25D366] text-white hover:bg-[#25D366]/90">
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </Button>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link to="/" className="text-muted-foreground hover:underline">
          ← Home
        </Link>
        <Link to="/history" className="font-semibold text-primary hover:underline">
          View order history →
        </Link>
      </div>
    </div>
  );
}
