import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Save,
  ShieldCheck,
  Lock,
  KeyRound,
  Mail,
  Landmark,
  Activity,
  CreditCard,
  Plus,
  Star,
  Archive,
  RotateCcw,
  Trash2,
  PlugZap,
  CheckCircle2,
} from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  financeChangePin,
  financeLogoutAll,
  financeSessionValid,
  financeSetup,
  financeStatus,
  financeUnlock,
  financeUpdateSettings,
  financeVerifyOtp,
  listActiveFinanceSessions,
  listFinanceEvents,
  readFinanceSession,
  storeFinanceSession,
  clearFinanceSession,
  type FinanceEvent,
  type FinanceSession,
  type FinanceStatus,
} from "@/lib/finance";
import { loadPaymentConfig, savePaymentConfig, isLiveReady } from "@/lib/payment/config";
import { EMPTY_PAYMENT_CONFIG, type PaymentConfig } from "@/lib/payment/types";
import {
  loadPaymentStatus,
  validateGateway,
  type PaymentStatusSnapshot,
  type Health,
} from "@/lib/payment/health";
import {
  listBankAccounts,
  saveBankAccount,
  setBankAccountArchived,
  setBankAccountEnabled,
  setDefaultBankAccount,
  deleteBankAccount,
  type BankAccount,
} from "@/lib/bank-accounts";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [
      { title: "Finance & Payment · CGCC Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <FinanceGate />
      </AdminShell>
    </AdminGuard>
  ),
});

/* ------------------------------------------------------------------ gate */

function FinanceGate() {
  const [status, setStatus] = useState<FinanceStatus | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await financeStatus();
    setStatus(s);
    const sid = readFinanceSession();
    setUnlocked(sid ? await financeSessionValid(sid) : false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh().catch(() => setLoading(false));
  }, [refresh]);

  // Inactivity timeout — the server extends the session on each heartbeat.
  useEffect(() => {
    if (!unlocked) return;
    const t = setInterval(async () => {
      const sid = readFinanceSession();
      if (!sid || !(await financeSessionValid(sid))) {
        clearFinanceSession();
        setUnlocked(false);
        toast.info("Finance session timed out. Enter your PIN again.");
      }
    }, 60_000);
    return () => clearInterval(t);
  }, [unlocked]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!status?.configured) return <SetupWizard onDone={refresh} />;
  if (!unlocked) return <UnlockPanel status={status} onUnlocked={() => setUnlocked(true)} />;
  return <FinancePanel status={status} onStatusChange={refresh} />;
}

/* --------------------------------------------------------------- wizard */

function SetupWizard({ onDone }: { onDone: () => Promise<void> }) {
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [otp, setOtp] = useState(false);
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    try {
      await financeSetup(pin, email, otp);
      toast.success("Finance security configured.");
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Setup failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-50 ring-1 ring-amber-200">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Finance security setup</h1>
            <p className="text-xs text-muted-foreground">Step {step} of 3</p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Create Finance Security PIN" hint="Minimum 6 digits">
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </Field>
            <Field label="Confirm PIN">
              <Input
                type="password"
                inputMode="numeric"
                value={pin2}
                onChange={(e) => setPin2(e.target.value)}
              />
            </Field>
            <Button
              className="w-full rounded-full"
              disabled={!/^[0-9]{6,12}$/.test(pin) || pin !== pin2}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
            {pin && !/^[0-9]{6,12}$/.test(pin) && (
              <p className="text-xs text-rose-600">PIN must be 6–12 digits.</p>
            )}
            {pin2 && pin !== pin2 && <p className="text-xs text-rose-600">PINs do not match.</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Finance Recovery Email" hint="Receives one-time passwords">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Confirm Email">
              <Input type="email" value={email2} onChange={(e) => setEmail2(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="flex-1 rounded-full"
                disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email !== email2}
                onClick={() => setStep(3)}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">Choose security method</p>
            <button
              type="button"
              onClick={() => setOtp(false)}
              className={`w-full rounded-2xl border-2 p-4 text-left ${!otp ? "border-brand bg-brand/5" : "border-border"}`}
            >
              <p className="font-bold">PIN only</p>
              <p className="text-xs text-muted-foreground">Fastest. PIN required on every visit.</p>
            </button>
            <button
              type="button"
              onClick={() => setOtp(true)}
              className={`w-full rounded-2xl border-2 p-4 text-left ${otp ? "border-brand bg-brand/5" : "border-border"}`}
            >
              <p className="font-bold">PIN + Email OTP</p>
              <p className="text-xs text-muted-foreground">
                A one-time password is also required. Strongest protection.
              </p>
            </button>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button className="flex-1 rounded-full" disabled={saving} onClick={finish}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Finish setup
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- unlock */

function UnlockPanel({ status, onUnlocked }: { status: FinanceStatus; onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpStage, setOtpStage] = useState(false);
  const [code, setCode] = useState("");
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(status.locked_until);

  async function submitPin() {
    setBusy(true);
    try {
      const res = await financeUnlock(pin);
      if (!res.ok) {
        if (res.locked_until) {
          setLockedUntil(res.locked_until);
          toast.error("Too many attempts. Finance is locked for 15 minutes.");
        } else {
          toast.error(`Incorrect PIN. ${res.attempts_left ?? 0} attempt(s) left.`);
        }
        return;
      }
      sessionRef.current = res.session_id ?? null;
      if (res.needs_otp) {
        setIssuedCode(res.otp_code ?? null);
        setOtpStage(true);
        toast.info(`One-time password issued for ${res.recovery_email ?? "your finance email"}.`);
      } else if (res.session_id) {
        storeFinanceSession(res.session_id);
        onUnlocked();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not verify PIN.");
    } finally {
      setBusy(false);
      setPin("");
    }
  }

  async function submitOtp() {
    if (!sessionRef.current) return;
    setBusy(true);
    try {
      const res = await financeVerifyOtp(sessionRef.current, code);
      if (!res.ok) {
        toast.error(res.reason === "expired" ? "Code expired. Start again." : "Incorrect code.");
        return;
      }
      storeFinanceSession(sessionRef.current);
      onUnlocked();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not verify code.");
    } finally {
      setBusy(false);
    }
  }

  const locked = lockedUntil ? new Date(lockedUntil) > new Date() : false;

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Finance & Payment</h1>
            <p className="text-xs text-muted-foreground">
              {otpStage ? "Enter the one-time password" : "Enter Finance Security PIN"}
            </p>
          </div>
        </div>

        {locked ? (
          <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
            Finance access is locked until {new Date(lockedUntil!).toLocaleTimeString()} after five
            incorrect PIN attempts. The event has been recorded in the audit log.
          </p>
        ) : otpStage ? (
          <div className="space-y-4">
            {issuedCode && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Email delivery is not configured for this project yet, so the code is shown here to
                the signed-in admin: <span className="font-mono font-bold">{issuedCode}</span>
              </p>
            )}
            <Input
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button
              className="w-full rounded-full"
              disabled={busy || code.length < 6}
              onClick={submitOtp}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify code
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              type="password"
              inputMode="numeric"
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pin.length >= 6) void submitPin();
              }}
            />
            <Button
              className="w-full rounded-full"
              disabled={busy || pin.length < 6}
              onClick={submitPin}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Unlock Finance
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- panel */

type PanelTab = "status" | "gateway" | "transfer" | "security";

function FinancePanel({
  status,
  onStatusChange,
}: {
  status: FinanceStatus;
  onStatusChange: () => Promise<void>;
}) {
  const [tab, setTab] = useState<PanelTab>("status");
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Finance & Payment</h1>
          <p className="text-sm text-muted-foreground">
            Every financial setting lives here and is stored in the database.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => {
            clearFinanceSession();
            window.location.reload();
          }}
        >
          <Lock className="mr-2 h-4 w-4" />Lock finance
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 rounded-full border border-border bg-card p-1">
        <Tab active={tab === "status"} onClick={() => setTab("status")} icon={Activity}>
          Status
        </Tab>
        <Tab active={tab === "gateway"} onClick={() => setTab("gateway")} icon={CreditCard}>
          Gateway
        </Tab>
        <Tab active={tab === "transfer"} onClick={() => setTab("transfer")} icon={Landmark}>
          Bank transfer
        </Tab>
        <Tab active={tab === "security"} onClick={() => setTab("security")} icon={ShieldCheck}>
          Security
        </Tab>
      </div>

      {tab === "status" && <StatusCard />}
      {tab === "gateway" && <GatewaySettings />}
      {tab === "transfer" && <BankAccounts />}
      {tab === "security" && <SecuritySettings status={status} onChanged={onStatusChange} />}
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition " +
        (active ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground")
      }
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

/* ----------------------------------------------------------- status card */

const DOT: Record<Health, string> = { healthy: "🟢", warning: "🟡", error: "🔴" };

function StatusCard() {
  const [snap, setSnap] = useState<PaymentStatusSnapshot | null>(null);
  useEffect(() => {
    void loadPaymentStatus()
      .then(setSnap)
      .catch(() => setSnap(null));
  }, []);

  if (!snap) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fmtTxn = (t: PaymentStatusSnapshot["lastSuccess"]) =>
    t
      ? `${t.code} · ₦${t.total.toLocaleString()} · ${
          t.payment_updated_at ? new Date(t.payment_updated_at).toLocaleString() : "—"
        }`
      : "None yet";

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-4 font-display text-lg font-bold">Payment integration status</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row
            label="Payment Gateway Status"
            value={`${DOT[snap.gatewayHealth]} ${snap.config.enabled ? "Enabled" : "Disabled"}`}
          />
          <Row
            label="Current Environment"
            value={snap.config.mode === "live" ? "Live" : "Sandbox (Test Mode)"}
          />
          <Row label="Current Payment Provider" value={snap.config.provider || "—"} />
          <Row label="Gateway Health" value={`${DOT[snap.gatewayHealth]} ${snap.gatewayMessage}`} />
          <Row label="Webhook Status" value={`${DOT[snap.webhookHealth]} ${snap.webhookMessage}`} />
          <Row label="Last Successful Transaction" value={fmtTxn(snap.lastSuccess)} />
          <Row label="Last Failed Transaction" value={fmtTxn(snap.lastFailed)} />
          <Row
            label="Last Synchronization"
            value={snap.lastSync ? new Date(snap.lastSync).toLocaleString() : "None yet"}
          />
          <Row label="Transfer Status" value={`${DOT[snap.transferHealth]} ${snap.transferMessage}`} />
          <Row
            label="Current Active Bank Account"
            value={
              snap.defaultAccount
                ? `${snap.defaultAccount.account_name} — ${snap.defaultAccount.account_number}`
                : "Not configured"
            }
          />
        </dl>
      </Card>

      {(snap.gatewayHealth !== "healthy" ||
        snap.webhookHealth !== "healthy" ||
        snap.transferHealth !== "healthy") && (
        <Card>
          <h3 className="font-bold">Troubleshooting</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {snap.gatewayHealth !== "healthy" && <li>• {snap.gatewayMessage}</li>}
            {snap.webhookHealth !== "healthy" && <li>• {snap.webhookMessage}</li>}
            {snap.transferHealth !== "healthy" && <li>• {snap.transferMessage}</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- gateway */

function GatewaySettings() {
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
      toast.success("Payment gateway configuration saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save configuration.");
    } finally {
      setSaving(false);
    }
  }

  function validate() {
    const res = validateGateway(cfg);
    if (res.ok) toast.success("Gateway configuration looks valid.");
    else toast.error(res.issues.join(" "));
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
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Online payment gateway</h2>
          <p className="text-xs text-muted-foreground">
            Provider-independent. Changing provider or credentials never requires code changes.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) => setCfg((c) => ({ ...c, enabled: v }))}
          />
          {cfg.enabled ? "Enabled" : "Disabled"}
        </label>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={cfg.mode === "test"}
          onClick={() => setCfg((c) => ({ ...c, mode: "test" }))}
          title="Sandbox (Test Mode)"
          subtitle="Simulate all outcomes without real money"
          tint="amber"
        />
        <ModeCard
          active={cfg.mode === "live"}
          disabled={!liveReady}
          onClick={() => {
            if (!liveReady) {
              toast.error("Fill in all credentials before enabling Live Mode.");
              return;
            }
            setCfg((c) => ({ ...c, mode: "live" }));
          }}
          title="Live Mode"
          subtitle={liveReady ? "Ready to accept real payments" : "Fill in all credentials first"}
          tint="emerald"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Payment Provider" hint="e.g. opay, paystack, flutterwave">
          <Input {...bind("provider")} />
        </Field>
        <Field label="Currency">
          <Input {...bind("currency")} />
        </Field>
        <Field label="Merchant ID">
          <Input {...bind("merchantId")} />
        </Field>
        <Field label="Public Key">
          <Input {...bind("publicKey")} />
        </Field>
        <Field label="Secret / API Key" hint="Write-only in practice — never displayed in plain text">
          <Input type="password" {...bind("secretKey")} />
        </Field>
        <Field label="Webhook Secret">
          <Input type="password" {...bind("webhookSecret")} />
        </Field>
        <Field label="Callback URL" hint="Provider posts payment events here" full>
          <Input
            placeholder="https://your-domain.lovable.app/api/public/opay/webhook"
            {...bind("callbackUrl")}
          />
        </Field>
        <Field label="Return URL" hint="Customer returns here after paying" full>
          <Input
            placeholder="https://your-domain.lovable.app/payment/opay/return"
            {...bind("returnUrl")}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" className="rounded-full" onClick={validate}>
          <PlugZap className="mr-2 h-4 w-4" />Validate connection
        </Button>
        <Button onClick={save} disabled={saving} className="rounded-full">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save credentials
        </Button>
      </div>
    </Card>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  subtitle,
  tint,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
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
      <p className="font-bold">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </button>
  );
}

/* --------------------------------------------------------- bank accounts */

function BankAccounts() {
  const [rows, setRows] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<{
    id?: string;
    bank_name: string;
    account_name: string;
    account_number: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setRows(await listBankAccounts(true));
    setLoading(false);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    try {
      await fn();
      await reload();
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
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
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Manual bank transfer</h2>
            <p className="text-xs text-muted-foreground">
              The default account appears on customer checkout instantly.
            </p>
          </div>
          <Button
            className="rounded-full"
            onClick={() => setDraft({ bank_name: "", account_name: "", account_number: "" })}
          >
            <Plus className="mr-2 h-4 w-4" />Add account
          </Button>
        </div>
      </Card>

      {draft && (
        <Card>
          <h3 className="mb-3 font-bold">{draft.id ? "Edit account" : "New account"}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bank Name">
              <Input
                value={draft.bank_name}
                onChange={(e) => setDraft({ ...draft, bank_name: e.target.value })}
              />
            </Field>
            <Field label="Account Name">
              <Input
                value={draft.account_name}
                onChange={(e) => setDraft({ ...draft, account_name: e.target.value })}
              />
            </Field>
            <Field label="Account Number">
              <Input
                inputMode="numeric"
                value={draft.account_number}
                onChange={(e) => setDraft({ ...draft, account_number: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              className="rounded-full"
              disabled={busy || !draft.bank_name || !draft.account_name || !draft.account_number}
              onClick={() =>
                run(async () => {
                  await saveBankAccount(draft);
                  setDraft(null);
                }, "Account saved.")
              }
            >
              <Save className="mr-2 h-4 w-4" />Save
            </Button>
          </div>
        </Card>
      )}

      {rows.length === 0 && (
        <Card>
          <p className="text-sm text-muted-foreground">
            No bank accounts yet. Add one so customers can pay by transfer.
          </p>
        </Card>
      )}

      {rows.map((a) => (
        <Card key={a.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display font-bold">
                {a.bank_name}{" "}
                {a.is_default && (
                  <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Default
                  </span>
                )}
                {a.archived_at && (
                  <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    Archived
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">{a.account_name}</p>
              <p className="font-mono text-lg font-semibold">{a.account_number}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-medium">
                <Switch
                  checked={a.enabled}
                  disabled={busy}
                  onCheckedChange={(v) =>
                    run(() => setBankAccountEnabled(a.id, v), v ? "Enabled." : "Disabled.")
                  }
                />
                {a.enabled ? "Enabled" : "Disabled"}
              </label>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={busy || a.is_default}
                onClick={() => run(() => setDefaultBankAccount(a.id), "Default account updated.")}
              >
                <Star className="mr-1 h-3.5 w-3.5" />Set default
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={busy}
                onClick={() =>
                  setDraft({
                    id: a.id,
                    bank_name: a.bank_name,
                    account_name: a.account_name,
                    account_number: a.account_number,
                  })
                }
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={busy}
                onClick={() =>
                  run(
                    () => setBankAccountArchived(a.id, !a.archived_at),
                    a.archived_at ? "Restored." : "Archived.",
                  )
                }
              >
                {a.archived_at ? (
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <Archive className="mr-1 h-3.5 w-3.5" />
                )}
                {a.archived_at ? "Restore" : "Archive"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-rose-600"
                disabled={busy}
                onClick={() => {
                  if (!confirm(`Delete ${a.bank_name} — ${a.account_number}? This cannot be undone.`))
                    return;
                  void run(() => deleteBankAccount(a.id), "Account deleted.");
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- security */

function SecuritySettings({
  status,
  onChanged,
}: {
  status: FinanceStatus;
  onChanged: () => Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [email, setEmail] = useState(status.recovery_email ?? "");
  const [otp, setOtp] = useState(status.otp_enabled);
  const [timeoutMinutes, setTimeoutMinutes] = useState(status.timeout_minutes);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<FinanceEvent[]>([]);
  const [sessions, setSessions] = useState<FinanceSession[]>([]);

  const reload = useCallback(async () => {
    const [e, s] = await Promise.all([listFinanceEvents(50), listActiveFinanceSessions()]);
    setEvents(e);
    setSessions(s);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    try {
      await fn();
      await onChanged();
      await reload();
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const failed = events.filter((e) => !e.success);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 font-display text-lg font-bold">Finance security</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current PIN">
            <Input
              type="password"
              inputMode="numeric"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="New PIN" hint="6–12 digits">
            <Input
              type="password"
              inputMode="numeric"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            className="rounded-full"
            disabled={busy || !current || !/^[0-9]{6,12}$/.test(next)}
            onClick={() =>
              run(async () => {
                await financeChangePin(current, next);
                setCurrent("");
                setNext("");
              }, "Finance PIN changed.")
            }
          >
            <KeyRound className="mr-2 h-4 w-4" />Change PIN
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-lg font-bold">Recovery & sessions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Finance Recovery Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Automatic timeout after inactivity (minutes)">
            <Input
              type="number"
              min={1}
              max={240}
              value={timeoutMinutes}
              onChange={(e) => setTimeoutMinutes(Number(e.target.value) || 1)}
            />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm font-medium">
          <Switch checked={otp} onCheckedChange={setOtp} />
          <Mail className="h-4 w-4" />
          {otp ? "PIN + Email OTP required" : "PIN only"}
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await financeLogoutAll();
                window.location.reload();
              }, "All finance sessions signed out.")
            }
          >
            Log out all finance sessions
          </Button>
          <Button
            className="rounded-full"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  financeUpdateSettings({
                    recoveryEmail: email || null,
                    otpEnabled: otp,
                    timeoutMinutes,
                  }),
                "Finance settings updated.",
              )
            }
          >
            <Save className="mr-2 h-4 w-4" />Save
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-lg font-bold">
          Active finance sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap justify-between gap-2 rounded-xl border border-border p-3"
              >
                <span className="font-medium">{s.user_label ?? "admin"}</span>
                <span className="text-muted-foreground">
                  last seen {new Date(s.last_seen_at).toLocaleTimeString()} · expires{" "}
                  {new Date(s.expires_at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-display text-lg font-bold">Finance login history</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {failed.length} failed attempt(s) recorded.
        </p>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No finance logins recorded yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 odd:bg-muted/30"
              >
                <span className="flex items-center gap-2">
                  {e.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Lock className="h-4 w-4 text-rose-600" />
                  )}
                  <span className="font-medium">{e.user_label ?? "admin"}</span>
                  <span className="text-xs uppercase text-muted-foreground">{e.event}</span>
                  {e.detail && <span className="text-xs text-muted-foreground">— {e.detail}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- helpers */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">{children}</div>;
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <Label className="text-xs font-semibold uppercase tracking-wider">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
