import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle2, TestTube2, Radio } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  loadPaymentConfig,
  savePaymentConfig,
  isLiveReady,
} from "@/lib/payment/config";
import { EMPTY_PAYMENT_CONFIG, type PaymentConfig } from "@/lib/payment/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/payment")({
  head: () => ({
    meta: [{ title: "Payment Configuration · CGCC Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <PaymentConfigPage />
      </AdminShell>
    </AdminGuard>
  ),
});

function PaymentConfigPage() {
  const [cfg, setCfg] = useState<PaymentConfig>(EMPTY_PAYMENT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadPaymentConfig(true).then((c) => {
      setCfg(c);
      setLoading(false);
    });
  }, []);

  function bind<K extends keyof PaymentConfig>(key: K) {
    return {
      value: String(cfg[key] ?? ""),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setCfg((c) => ({ ...c, [key]: e.target.value })),
    };
  }

  async function save() {
    setSaving(true);
    try {
      await savePaymentConfig(cfg);
      toast.success("Payment configuration saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save configuration.");
    } finally {
      setSaving(false);
    }
  }

  function switchMode(next: "test" | "live") {
    if (next === "live" && !isLiveReady(cfg)) {
      toast.error("Enter Merchant ID, Public Key, Secret Key, Callback URL and Return URL before enabling Live Mode.");
      return;
    }
    setCfg((c) => ({ ...c, mode: next }));
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const liveReady = isLiveReady(cfg);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Payment Configuration</h1>
          <p className="text-sm text-muted-foreground">
            OPay Online Payment credentials. Nothing is hardcoded — inserting these
            values switches the customer flow from the simulator to real OPay checkout.
          </p>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={cfg.mode === "test"}
          onClick={() => switchMode("test")}
          icon={TestTube2}
          title="Test Mode"
          subtitle="Simulate all outcomes without real money"
          tint="amber"
        />
        <ModeCard
          active={cfg.mode === "live"}
          onClick={() => switchMode("live")}
          icon={Radio}
          title="Live Mode"
          subtitle={liveReady ? "Ready to accept real payments" : "Fill in all credentials first"}
          tint="emerald"
          disabled={!liveReady}
        />
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <Section title="OPay merchant credentials">
          <Field label="Merchant ID" hint="From your OPay merchant dashboard">
            <Input placeholder="e.g. 256612…" {...bind("merchantId")} />
          </Field>
          <Field label="Public Key" hint="Used to initialize checkout">
            <Input placeholder="OPAYPUB…" {...bind("publicKey")} />
          </Field>
          <Field label="Secret Key" hint="Used to sign server requests — keep private">
            <Input type="password" placeholder="OPAYSEC…" {...bind("secretKey")} />
          </Field>
          <Field label="Webhook Secret" hint="Used to verify webhook signatures">
            <Input type="password" placeholder="whsec_…" {...bind("webhookSecret")} />
          </Field>
        </Section>

        <Section title="Endpoints">
          <Field label="Callback URL" hint="OPay will POST payment events here">
            <Input placeholder="https://your-domain.lovable.app/api/public/opay/webhook" {...bind("callbackUrl")} />
          </Field>
          <Field label="Return URL" hint="Customer is redirected here after paying">
            <Input placeholder="https://your-domain.lovable.app/payment/opay/return" {...bind("returnUrl")} />
          </Field>
          <Field label="Currency">
            <Input placeholder="NGN" {...bind("currency")} />
          </Field>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={cfg.mode === "live"}
              onCheckedChange={(v) => switchMode(v ? "live" : "test")}
            />
            <span className="font-medium">
              {cfg.mode === "live" ? "Live Mode enabled" : "Test Mode enabled"}
            </span>
            {liveReady && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Live-ready
              </span>
            )}
          </label>
          <Button onClick={save} disabled={saving} className="rounded-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save configuration
          </Button>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Security architecture is already in place: webhook signature verification,
        payment reference deduplication, amount verification, and order-ownership
        checks all live in the payment service. When you paste live credentials
        above and switch to Live Mode, no further code changes are required.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ModeCard({
  active, onClick, icon: Icon, title, subtitle, tint, disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  tint: "amber" | "emerald";
  disabled?: boolean;
}) {
  const activeCls =
    tint === "amber"
      ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
      : "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? activeCls : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <Icon className={`h-5 w-5 ${tint === "amber" ? "text-amber-600" : "text-emerald-600"}`} />
      <p className="mt-2 font-bold">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </button>
  );
}
