// Shared payment types. Keeps the app UI and any future provider driver
// speaking the same language so switching from Test Mode to Live OPay is a
// credentials change, not a rewrite.

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type PaymentProvider = "opay" | "manual_transfer";

export type PaymentMode = "test" | "live";

export type PaymentConfig = {
  mode: PaymentMode;
  merchantId: string;
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  callbackUrl: string;
  returnUrl: string;
  currency: string; // e.g. NGN
};

export const EMPTY_PAYMENT_CONFIG: PaymentConfig = {
  mode: "test",
  merchantId: "",
  publicKey: "",
  secretKey: "",
  webhookSecret: "",
  callbackUrl: "",
  returnUrl: "",
  currency: "NGN",
};

export type InitPaymentInput = {
  orderCode: string;
  amount: number; // integer minor units OR whole naira — we use whole naira
  customerName: string;
  phone: string;
  email?: string;
  returnUrl: string;
};

export type InitPaymentResult = {
  reference: string;
  authorizationUrl?: string; // real OPay flow will redirect here
  provider: PaymentProvider;
  mode: PaymentMode;
};

export type PaymentResult = {
  reference: string;
  status: Exclude<PaymentStatus, "unpaid">;
  provider: PaymentProvider;
  amount: number;
  meta?: Record<string, unknown>;
};

export type SimulatedOutcome = "success" | "failed" | "cancelled" | "timeout";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Payment Pending",
  pending: "Payment Pending",
  paid: "Payment Successful",
  failed: "Payment Failed",
  cancelled: "Payment Cancelled",
  refunded: "Refunded",
};

export const PAYMENT_STATUS_TONE: Record<
  PaymentStatus,
  "muted" | "amber" | "emerald" | "rose"
> = {
  unpaid: "amber",
  pending: "amber",
  paid: "emerald",
  failed: "rose",
  cancelled: "rose",
  refunded: "muted",
};
