// Shared payment types. Keeps the app UI and any future provider driver
// speaking the same language so switching provider or going live is a
// credentials change in the Admin Dashboard, not a rewrite.

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type GatewayProviderId = "opay" | "wema" | "paystack" | "flutterwave";

export type PaymentProvider = GatewayProviderId | "manual_transfer";

export type PaymentMode = "test" | "live";

export type ProviderCredentials = {
  merchantId: string;
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  callbackUrl: string;
  returnUrl: string;
};

export const EMPTY_CREDENTIALS: ProviderCredentials = {
  merchantId: "",
  publicKey: "",
  secretKey: "",
  webhookSecret: "",
  callbackUrl: "",
  returnUrl: "",
};

export type ProviderMeta = {
  id: GatewayProviderId;
  name: string;
  blurb: string;
  merchantLabel: string;
  publicLabel: string;
  secretLabel: string;
  merchantPlaceholder: string;
  publicPlaceholder: string;
  secretPlaceholder: string;
  /** Provider needs a merchant/business ID as well as keys. */
  usesMerchantId: boolean;
};

export const GATEWAY_PROVIDERS: ProviderMeta[] = [
  {
    id: "opay",
    name: "OPay",
    blurb: "Cards, bank transfer and OPay wallet checkout.",
    merchantLabel: "Merchant ID",
    publicLabel: "Public Key",
    secretLabel: "Secret Key",
    merchantPlaceholder: "e.g. 256612…",
    publicPlaceholder: "OPAYPUB…",
    secretPlaceholder: "OPAYSEC…",
    usesMerchantId: true,
  },
  {
    id: "wema",
    name: "Wema Bank (ALAT)",
    blurb: "Wema / ALAT collections and virtual account payments.",
    merchantLabel: "Merchant / Business ID",
    publicLabel: "Client ID / API Key",
    secretLabel: "Client Secret",
    merchantPlaceholder: "e.g. CGCC-CAFE-001",
    publicPlaceholder: "Client ID from Wema",
    secretPlaceholder: "Client Secret from Wema",
    usesMerchantId: true,
  },
  {
    id: "paystack",
    name: "Paystack",
    blurb: "Cards, transfers, USSD and bank accounts.",
    merchantLabel: "Business / Subaccount Code",
    publicLabel: "Public Key",
    secretLabel: "Secret Key",
    merchantPlaceholder: "Optional — ACCT_…",
    publicPlaceholder: "pk_live_…",
    secretPlaceholder: "sk_live_…",
    usesMerchantId: false,
  },
  {
    id: "flutterwave",
    name: "Flutterwave",
    blurb: "Cards, bank transfer, USSD and mobile money.",
    merchantLabel: "Merchant ID",
    publicLabel: "Public Key",
    secretLabel: "Secret Key",
    merchantPlaceholder: "Optional",
    publicPlaceholder: "FLWPUBK-…",
    secretPlaceholder: "FLWSECK-…",
    usesMerchantId: false,
  },
];

export function providerMeta(id: string): ProviderMeta {
  const fallback = GATEWAY_PROVIDERS[0];
  if (!fallback) throw new Error('No payment provider is configured');
  return GATEWAY_PROVIDERS.find((p) => p.id === id) ?? fallback;
}

export type PaymentConfig = {
  mode: PaymentMode;
  enabled: boolean;
  preferredMethod?: 'online' | 'transfer';
  provider: GatewayProviderId;
  currency: string; // e.g. NGN
  /** Per-provider credentials, so switching provider keeps saved keys. */
  credentials: Partial<Record<GatewayProviderId, ProviderCredentials>>;
  /** Legacy flat fields — kept so older records keep working. */
  merchantId?: string;
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  callbackUrl?: string;
  returnUrl?: string;
};

export const EMPTY_PAYMENT_CONFIG: PaymentConfig = {
  mode: "test",
  enabled: true,
  provider: "opay",
  currency: "NGN",
  credentials: {},
};

export type InitPaymentInput = {
  orderCode: string;
  amount: number; // whole naira
  customerName: string;
  phone: string;
  email?: string;
  returnUrl: string;
};

export type InitPaymentResult = {
  reference: string;
  authorizationUrl?: string;
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
