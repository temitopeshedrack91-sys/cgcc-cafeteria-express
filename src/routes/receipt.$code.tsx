import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, MessageCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { formatNaira, useStore } from "@/lib/store";

const WHATSAPP_NUMBER = "09134749319"; // Business number

export const Route = createFileRoute("/receipt/$code")({
  head: ({ params }) => ({ meta: [{ title: `Receipt ${params.code} · CGCC Cafeteria Express` }] }),
  component: ReceiptPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Receipt not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">This order code doesn't exist.</p>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  ),
});

function ReceiptPage() {
  const { code } = Route.useParams();
  const order = useStore((s) => s.orders.find((o) => o.code === code));

  if (!order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Receipt not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This order code doesn't exist on this device.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }


  function download() {
    if (!order) return;
    const lines = [
      "CGCC CAFETERIA EXPRESS",
      "The Citadel Global Community Church",
      "-----------------------------------",
      `Receipt No: ${order.receiptNo}`,
      `Order Code: ${order.code}`,
      `Customer:   ${order.customerName}`,
      `Phone:      ${order.phone}`,
      `Type:       ${order.orderType}`,
      order.note ? `Note:       ${order.note}` : "",
      "-----------------------------------",
      ...order.items.map(
        (i) => `${i.qty} x ${i.name}  ${formatNaira(i.price * i.qty)}`,
      ),
      "-----------------------------------",
      `TOTAL:      ${formatNaira(order.total)}`,
      `Payment:    ${order.paymentStatus.toUpperCase()}`,
      `Pickup:     ${order.pickupStatus.toUpperCase()}`,
      "",
      "Thank you and God bless.",
    ]
      .filter(Boolean)
      .join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CGCC-${order.code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function whatsapp() {
    if (!order) return;
    const msg =
      `Hello CGCC Cafeteria,\n\n` +
      `My name is ${order.customerName}.\n\n` +
      `I have completed payment.\n\n` +
      `Order Code:\n${order.code}\n\n` +
      `Receipt Number:\n${order.receiptNo}\n\n` +
      `Total:\n${formatNaira(order.total)}\n\n` +
      `Kindly confirm my payment and prepare my order.\n\n` +
      `Thank you.`;
    // Convert 09134749319 -> 2349134749319
    const digits = WHATSAPP_NUMBER.replace(/\D/g, "");
    const intl = digits.startsWith("0") ? "234" + digits.slice(1) : digits;
    const url = `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6 pb-16">
      <div className="mb-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
        <h1 className="mt-2 font-display text-2xl font-bold">Order Confirmed</h1>
        <p className="text-sm text-muted-foreground">Show this code at the cafeteria counter.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
        {/* Perforated top */}
        <div className="bg-primary p-6 text-center text-primary-foreground">
          <Logo className="mx-auto h-10 w-auto brightness-0 invert-0" />
          <p className="mt-3 text-xs uppercase tracking-widest text-brand">Order Code</p>
          <p className="font-display text-5xl font-black tracking-wider">{order.code}</p>
          <p className="mt-2 text-xs text-primary-foreground/70">Receipt · {order.receiptNo}</p>
        </div>

        <div className="space-y-4 p-6">
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
              <p className="font-semibold">{new Date(order.createdAt).toLocaleTimeString()}</p>
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
            <div className="rounded-lg bg-brand/10 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment</p>
              <p className="mt-0.5 text-sm font-bold uppercase text-primary">{order.paymentStatus}</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pickup</p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-sm font-bold uppercase">
                <Clock className="h-3 w-3" />
                {order.pickupStatus}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={download} className="h-12 rounded-full">
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        <Button onClick={whatsapp} className="h-12 rounded-full bg-[#25D366] text-white hover:bg-[#25D366]/90">
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </Button>
      </div>

      <div className="mt-6 text-center">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
