import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PlugZap, Radio, Save, TestTube2 } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { PaymentStatusCard } from "@/components/PaymentStatusCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  activeCredentials,
  isLiveReady,
  loadPaymentConfig,
  savePaymentConfig,
  withCredentials,
} from "@/lib/payment/config";
import { validateGateway } from "@/lib/payment/health";
import {
  EMPTY_PAYMENT_CONFIG,
  GATEWAY_PROVIDERS,
  providerMeta,
  type GatewayProviderId,
  type PaymentConfig,
  type ProviderCredentials,
} from "@/lib/payment/types";
import { logAudit } from "@/lib/admin-ops";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/payment")({
  head: () => ({
    meta: [
      { title: "Online Payment Gateway · CGCC Admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Configure the online payment gateway provider, mode and credentials.",
      },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <GatewayPage />
      </AdminShell>
    </AdminGuard>
  ),
});

function GatewayPage() {
  const [cfg, setCfg] = useState<PaymentConfig>(EMPTY_PAYMENT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<string[] | null>(null);

  useEffect(() => {
    void loadPaymentConfig(true).then((c) => {
      setCfg(c);
      setLoading(false);
    });
  }, []);

  const creds = activeCredentials(cfg);
  const meta = providerMeta(cfg.provider);
  const liveReady = isLiveReady(cfg);

  function setCred<K extends keyof ProviderCredentials>(key: K, value: string) {
    setCfg((c) => withCredentials(c, c.provider, { ...activeCredentials(c), [key]: value }));
  }

  function selectProvider(id: GatewayProviderId) {
    setCfg((c) => {
      // Persist the current provider's credentials before switching.
      const kept = withCredentials(c, c.provider, activeCredentials(c));
      return { ...kept, provider: id, mode: "test" };
    });
    setIssues(null);
  }

  function switchMode(next: "test" | "live") {
    if (next === "live") {
      const check = validateGateway({ ...cfg, mode: "live" });
      if (!check.ok) {
        setIssues(check.issues);
        toast.error("Complete the credentials before enabling Live Mode.");
        return;
      }
    }
    setIssues(null);
    setCfg((c) => ({ ...c, mode: next }));
  }

  function validate() {
    const check = validateGateway(cfg);
    setIssues(check.issues);
    if (check.ok) toast.success("Configuration looks valid.");
    else toast.error(`${check.issues.length} item(s) need attention.`);
  }

  async function save() {
    setSaving(true);
    try {
      const normalized = withCredentials(cfg, cfg.provider, creds);
      await savePaymentConfig(normalized);
      await logAudit("payment.gateway_update", "app_settings", "global", {
        provider: normalized.provider,
        mode: normalized.mode,
        enabled: normalized.enabled,
      });
      toast.success("Gateway configuration saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save configuration.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Online Payment Gateway</h1>
        <p className="text-sm text-muted-foreground">
          Card and wallet payments. Completely independent of Manual Bank Transfer —
          disabling this page never stops customers paying by transfer.
        </p>
      </div>

      <div className="mb-6">
        <PaymentStatusCard />
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">Gateway enabled</p>
            <p className="text-xs text-muted-foreground">
              When off, the online payment option is hidden from customers.
            </p>
          </div>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) => setCfg((c) => ({ ...c, enabled: v }))}
          />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Payment provider
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {GATEWAY_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProvider(p.id)}
              className={`rounded-2xl border-2 p-4 text-left transition ${
                cfg.provider === p.id
                  ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <p className="font-bold">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.blurb}</p>
              {cfg.credentials?.[p.id]?.secretKey && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Credentials saved
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={cfg.mode === "test"}
          onClick={() => switchMode("test")}
          icon={TestTube2}
          title="Test Mode"
          subtitle="Simulate every outcome without real money"
          tint="amber"
        />
        <ModeCard
          active={cfg.mode === "live"}
          onClick={() => switchMode("live")}
          icon={Radio}
          title="Live Mode"
          subtitle={liveReady ? "Ready to accept real payments" : "Fill in all credentials first"}
          tint="emerald"
        />
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <Section title={`${meta.name} credentials`}>
          <Field label={meta.merchantLabel} hint={meta.usesMerchantId ? "Required for live payments" : "Optional"}>
            <Input
              placeholder={meta.merchantPlaceholder}
              value={creds.merchantId}
              onChange={(e) => setCred("merchantId", e.target.value)}
            />
          </Field>
          <Field label={meta.publicLabel} hint="Used to initialize checkout">
            <Input
              placeholder={meta.publicPlaceholder}
              value={creds.publicKey}
              onChange={(e) => setCred("publicKey", e.target.value)}
            />
          </Field>
          <Field label={meta.secretLabel} hint="Signs server requests — keep private">
            <Input
              type="password"
              placeholder={meta.secretPlaceholder}
              value={creds.secretKey}
              onChange={(e) => setCred("secretKey", e.target.value)}
            />
          </Field>
          <Field label="Webhook Secret" hint="Verifies incoming payment notifications">
            <Input
              type="password"
              placeholder="whsec_…"
              value={creds.webhookSecret}
              onChange={(e) => setCred("webhookSecret", e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Endpoints">
          <Field label="Callback URL" hint="The provider POSTs payment events here">
            <Input
              placeholder="https://your-domain.lovable.app/api/public/opay/webhook"
              value={creds.callbackUrl}
              onChange={(e) => setCred("callbackUrl", e.target.value)}
            />
          </Field>
          <Field label="Return URL" hint="Customer is redirected here after paying">
            <Input
              placeholder="https://your-domain.lovable.app/payment/opay/return"
              value={creds.returnUrl}
              onChange={(e) => setCred("returnUrl", e.target.value)}
            />
          </Field>
          <Field label="Currency">
            <Input
              placeholder="NGN"
              value={cfg.currency}
              onChange={(e) => setCfg((c) => ({ ...c, currency: e.target.value }))}
            />
          </Field>
        </Section>

        {issues && issues.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Fix these before going live:</p>
            <ul className="mt-1 space-y-0.5">
              {issues.map((i) => (
                <li key={i}>• {i}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-sm font-medium">
            {cfg.mode === "live" ? "Live Mode enabled" : "Test Mode enabled"}
            {liveReady && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Live-ready
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={validate}>
              <PlugZap className="mr-2 h-4 w-4" />
              Validate credentials
            </Button>
            <Button onClick={save} disabled={saving} className="rounded-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save configuration
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Webhook signature verification, reference deduplication, amount verification
        and order-ownership checks are already enforced server-side. Pasting live
        credentials above and switching to Live Mode needs no code changes.
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
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
  tint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  tint: "amber" | "emerald";
}) {
  const activeCls =
    tint === "amber"
      ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
      : "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border-2 p-4 text-left transition ${
        active ? activeCls : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <Icon className={`h-5 w-5 ${tint === "amber" ? "text-amber-600" : "text-emerald-600"}`} />
      <p className="mt-2 font-bold">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </button>
  );
}
