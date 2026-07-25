import type { Order, OrderStatus } from "./store";

// Consistent status colors used across customer-facing views.
// RED   → received / waiting / payment pending
// AMBER → preparing / ready
// GREEN → collected / completed
export type StatusTone = "red" | "amber" | "green";

export function pickupTone(status: OrderStatus): StatusTone {
  if (status === "collected") return "green";
  if (status === "preparing" || status === "ready") return "amber";
  return "red"; // pending / confirmed
}

export function paymentTone(status: Order["paymentStatus"]): StatusTone {
  if (status === "paid") return "green";
  if (status === "failed" || status === "cancelled") return "red";
  return "amber"; // unpaid / pending / refunded
}

export function pickupLabel(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "Order Received";
    case "confirmed":
      return "Payment Confirmed";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready for Pickup";
    case "collected":
      return "Collected";
  }
}

export const toneClasses: Record<StatusTone, string> = {
  red: "bg-red-100 text-red-700 ring-1 ring-red-200",
  amber: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  green: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
};

export const toneDot: Record<StatusTone, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
};

// Timeline stages with completion logic
export type TimelineStep = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
};

export function buildTimeline(order: Order): TimelineStep[] {
  const paid = order.paymentStatus === "paid";
  const s = order.pickupStatus;
  const rank: Record<OrderStatus, number> = {
    pending: 0,
    confirmed: 1,
    preparing: 2,
    ready: 3,
    collected: 4,
  };
  const r = rank[s];
  const steps = [
    { key: "received", label: "Order Received", done: true },
    { key: "payment", label: "Payment Confirmed", done: paid || r >= 1 },
    { key: "preparing", label: "Preparing", done: r >= 2 },
    { key: "ready", label: "Ready for Pickup", done: r >= 3 },
    { key: "collected", label: "Collected", done: r >= 4 },
  ];
  // First not-done step is "active"
  const activeIdx = steps.findIndex((st) => !st.done);
  return steps.map((st, i) => ({ ...st, active: i === activeIdx }));
}
