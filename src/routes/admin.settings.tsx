import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Save,
  Building2,
  ShieldCheck,
  Upload,
  Trash2,
  Image as ImageIcon,
  UserCog,
  KeyRound,
  Mail,
  LogOut,
  UserPlus,
  Send,
} from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_SETTINGS,
  WEEKDAYS,
  loadSettings,
  saveSettings,
  type SystemSettings,
} from "@/lib/settings";
import { uploadLogoImage, validateLogoFile } from "@/lib/admin-ops";
import {
  createAdminAccount,
  listAdminAccounts,
  removeAdminAccount,
  setAdminAccountPassword,
  signOutAdminAccount,
  updateMyAdminLogin,
  type AdminAccountInfo,
} from "@/lib/admin-accounts.functions";
import { getFinanceEmailStatus, sendFinanceTestEmail } from "@/lib/finance.functions";
import { actions } from "@/lib/store";
import { toast } from "sonner";

type Tab = "general" | "accounts" | "roles";

export const Route = createFileRoute("/admin/settings")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const t = search.tab;
    if (t === "general" || t === "accounts" || t === "roles") return { tab: t };
    return {};
  },
  head: () => ({ meta: [...pageMeta("System Settings · CGCC Admin", "Manage CGCC cafeteria system settings."), { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <SystemSettingsPage />
      </AdminShell>
    </AdminGuard>
  ),
});

function SystemSettingsPage() {
  const search = Route.useSearch();
  const [tab, setTab] = useState<Tab>(search.tab ?? "general");

  useEffect(() => {
    if (search.tab) setTab(search.tab);
  }, [search.tab]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">System Settings</h1>
        <p className="text-sm text-muted-foreground">
          Central control panel. Everything here is stored in the database and applies
          across the app immediately — no code changes needed.
        </p>
      </div>

      <div className="mb-6 inline-flex flex-wrap rounded-full border border-border bg-card p-1">
        <TabBtn active={tab === "general"} onClick={() => setTab("general")} icon={Building2}>
          General
        </TabBtn>
        <TabBtn active={tab === "accounts"} onClick={() => setTab("accounts")} icon={UserCog}>
          Accounts &amp; Security
        </TabBtn>
        <TabBtn active={tab === "roles"} onClick={() => setTab("roles")} icon={ShieldCheck}>
          Role permissions
        </TabBtn>
      </div>

      {tab === "general" && <GeneralSettings />}
      {tab === "accounts" && <AdminAccountsAndSecurity />}
      {tab === "roles" && <RolePermissions />}
    </div>
  );
}

function TabBtn({
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

function GeneralSettings() {
  const [cfg, setCfg] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadSettings(true).then((s) => {
      setCfg(s);
      setLoading(false);
    });
  }, []);

  function bind<K extends keyof SystemSettings>(key: K) {
    return {
      value: String(cfg[key] ?? ""),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setCfg((c) => ({ ...c, [key]: e.target.value })),
    };
  }
  function bindNumber<K extends keyof SystemSettings>(key: K) {
    return {
      value: String(cfg[key] ?? ""),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setCfg((c) => ({ ...c, [key]: Number(e.target.value) || 0 })),
    };
  }

  function toggleDay(day: string) {
    setCfg((c) => ({
      ...c,
      operatingDays: c.operatingDays.includes(day)
        ? c.operatingDays.filter((d) => d !== day)
        : [...WEEKDAYS].filter((d) => d === day || c.operatingDays.includes(d)),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      await saveSettings(cfg);
      toast.success("Settings saved. Changes are live across the app.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings.");
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
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <Section title="Identity">
        <Field label="Church Name">
          <Input {...bind("churchName")} />
        </Field>
        <Field label="Cafeteria Name">
          <Input {...bind("cafeteriaName")} />
        </Field>
        <LogoField
          label="Church Logo"
          value={cfg.churchLogoUrl}
          onChange={(url) => setCfg((c) => ({ ...c, churchLogoUrl: url }))}
        />
        <LogoField
          label="Cafeteria Logo"
          value={cfg.cafeteriaLogoUrl}
          onChange={(url) => setCfg((c) => ({ ...c, cafeteriaLogoUrl: url }))}
        />
      </Section>


      <Section title="Contact">
        <Field label="Contact Phone Number">
          <Input {...bind("contactPhone")} />
        </Field>
        <Field label="Official Email">
          <Input type="email" {...bind("officialEmail")} />
        </Field>
        <Field label="Address" full>
          <Input {...bind("address")} />
        </Field>
      </Section>

      <Section title="Operating hours">
        <div className="sm:col-span-2">
          <Label className="text-xs font-semibold uppercase tracking-wider">Operating Days</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = cfg.operatingDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={
                    "rounded-full border px-3 py-1 text-sm font-medium transition " +
                    (on
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40")
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Opening Time">
          <Input type="time" {...bind("openingTime")} />
        </Field>
        <Field label="Closing Time">
          <Input type="time" {...bind("closingTime")} />
        </Field>
        <Field
          label="Pickup Time Interval (minutes)"
          hint="Spacing between scheduled slots (e.g. 15 or 20 mins). Customers can also choose 'Pick up now'."
        >
          <div className="space-y-2">
            <Input type="number" min={5} step={5} {...bindNumber("pickupIntervalMinutes")} />
            <div className="flex flex-wrap gap-1.5">
              {[10, 15, 20, 30].map((mins) => (
                <Button
                  key={mins}
                  type="button"
                  size="sm"
                  variant={cfg.pickupIntervalMinutes === mins ? "default" : "outline"}
                  className="h-7 rounded-full px-2.5 text-xs"
                  onClick={() => setCfg((c) => ({ ...c, pickupIntervalMinutes: mins }))}
                >
                  {mins} min
                </Button>
              ))}
            </div>
          </div>
        </Field>
        <Field label="Maximum Pickup Time (minutes ahead)">
          <Input type="number" min={15} step={15} {...bindNumber("maxPickupMinutes")} />
        </Field>
      </Section>

      <Section title="Pricing & Vendor Commission">
        <Field
          label="Default Vendor Payout (%)"
          hint={`Vendors receive ${cfg.defaultVendorPayoutPercent ?? 85}% and CGCC keeps ${Math.max(0, 100 - (cfg.defaultVendorPayoutPercent ?? 85))}% service charge.`}
        >
          <div className="space-y-2">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={String(cfg.defaultVendorPayoutPercent ?? 85)}
              onChange={(e) => {
                const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                setCfg((c) => ({
                  ...c,
                  defaultVendorPayoutPercent: v,
                  payoutPercents: { food: v, snacks: v, coffee: v, drinks: v },
                }));
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "85% Vendor / 15% CGCC", val: 85 },
                { label: "90% Vendor / 10% CGCC", val: 90 },
                { label: "100% / 0%", val: 100 },
              ].map((preset) => (
                <Button
                  key={preset.val}
                  type="button"
                  size="sm"
                  variant={cfg.defaultVendorPayoutPercent === preset.val ? "default" : "outline"}
                  className="h-7 rounded-full px-2.5 text-xs"
                  onClick={() =>
                    setCfg((c) => ({
                      ...c,
                      defaultVendorPayoutPercent: preset.val,
                      payoutPercents: {
                        food: preset.val,
                        snacks: preset.val,
                        coffee: preset.val,
                        drinks: preset.val,
                      },
                    }))
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </Field>
        <Field
          label="CGCC Service Charge (%)"
          hint="Auto-calculated from Vendor Payout %; section-specific rates can be fine-tuned in Admin → Payouts."
        >
          <Input
            readOnly
            value={`${Math.max(0, Math.round((100 - (cfg.defaultVendorPayoutPercent ?? 85)) * 100) / 100)}%`}
            className="bg-muted text-muted-foreground"
          />
        </Field>
      </Section>

      <Section title="Messages & Return Policy">
        <Field label="Welcome Message" full>
          <Textarea rows={2} {...bind("welcomeMessage")} />
        </Field>
        <Field label="System Announcement" hint="Shown to customers on the home page when filled." full>
          <Textarea rows={2} {...bind("announcement")} />
        </Field>
        <Field
          label="Maintenance Message"
          hint="Displayed prominently while maintenance is in progress. Leave blank to hide."
          full
        >
          <Textarea rows={2} {...bind("maintenanceMessage")} />
        </Field>
        <Field
          label="Return & Refund Policy"
          hint="Displayed to customers on Checkout, Payment, and Receipt pages. Leave blank to hide."
          full
        >
          <Textarea rows={3} {...bind("refundPolicy")} />
        </Field>
        <Field label="Receipt Footer Text" full>
          <Input {...bind("receiptFooterText")} />
        </Field>
      </Section>

      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={save} disabled={saving} className="rounded-full">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save settings
        </Button>
      </div>
    </div>
  );
}

function AdminAccountsAndSecurity() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AdminAccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [newMyEmail, setNewMyEmail] = useState("");
  const [newMyPassword, setNewMyPassword] = useState("");
  const [confirmMyPassword, setConfirmMyPassword] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");

  const [pwTarget, setPwTarget] = useState<AdminAccountInfo | null>(null);
  const [targetPw, setTargetPw] = useState("");

  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean;
    provider: "smtp" | "resend" | null;
    fromLabel: string | null;
  } | null>(null);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [acctRes, mailRes] = await Promise.all([
        listAdminAccounts(),
        getFinanceEmailStatus().catch(() => null),
      ]);
      setAccounts(acctRes.accounts);
      const current = acctRes.accounts.find((a) => a.is_current);
      if (current) setNewMyEmail(current.email);
      setEmailStatus(mailRes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load admin accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentAccount = accounts.find((a) => a.is_current);

  async function saveMyEmail() {
    const trimmed = newMyEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (trimmed === currentAccount?.email.toLowerCase()) {
      toast.info("That is already your current login email.");
      return;
    }
    setBusy(true);
    try {
      await updateMyAdminLogin({ data: { email: trimmed } });
      toast.success("Admin login email updated! Please sign in with your new email.");
      await actions.adminLogout();
      navigate({ to: "/admin/login" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update login email.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMyPassword() {
    if (newMyPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (newMyPassword !== confirmMyPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await updateMyAdminLogin({ data: { password: newMyPassword } });
      setNewMyPassword("");
      setConfirmMyPassword("");
      toast.success("Your admin password has been updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddAdmin() {
    const email = addEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (addPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await createAdminAccount({ data: { email, password: addPassword } });
      toast.success(`Admin account created for ${email}.`);
      setAddOpen(false);
      setAddEmail("");
      setAddPassword("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create admin account.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveTargetPassword() {
    if (!pwTarget) return;
    if (targetPw.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await setAdminAccountPassword({ data: { targetUserId: pwTarget.id, password: targetPw } });
      toast.success(`Password updated and existing sessions signed out for ${pwTarget.email}.`);
      setPwTarget(null);
      setTargetPw("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOutUser(acct: AdminAccountInfo) {
    setBusy(true);
    try {
      await signOutAdminAccount({ data: { targetUserId: acct.id } });
      if (acct.is_current) {
        await actions.adminLogout();
        navigate({ to: "/admin/login" });
        return;
      }
      toast.success(`All active sessions signed out for ${acct.email}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign out sessions.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveAdmin(acct: AdminAccountInfo) {
    setBusy(true);
    try {
      await removeAdminAccount({ data: { targetUserId: acct.id } });
      toast.success(`Admin access removed for ${acct.email}.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove admin access.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendTestEmail() {
    setTestingEmail(true);
    setTestEmailFeedback(null);
    try {
      const res = await sendFinanceTestEmail({
        data: { toEmail: testEmailTo.trim() || undefined },
      });
      const msg = `Test email sent to ${res.sentTo} via ${res.provider?.toUpperCase()}.`;
      setTestEmailFeedback({ ok: true, message: msg });
      toast.success(msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not send test email.";
      setTestEmailFeedback({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingEmail(false);
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
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-5">
        <div>
          <h2 className="font-display text-lg font-bold">My Admin Login Credentials</h2>
          <p className="text-sm text-muted-foreground">
            Switch from a personal email to the official Cafeteria Outlook email, or update your login password.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Admin Login Email"
            hint={`Currently signed in as: ${currentAccount?.email ?? "—"}. Changing this updates your login immediately.`}
          >
            <div className="flex gap-2">
              <Input
                type="email"
                value={newMyEmail}
                onChange={(e) => setNewMyEmail(e.target.value)}
                placeholder="cafeteria@domain.com"
              />
              <Button type="button" onClick={() => void saveMyEmail()} disabled={busy} className="shrink-0 rounded-full">
                Update Email
              </Button>
            </div>
          </Field>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider">Change My Password</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                type="password"
                value={newMyPassword}
                onChange={(e) => setNewMyPassword(e.target.value)}
                placeholder="New password (min 8)"
                autoComplete="new-password"
              />
              <Input
                type="password"
                value={confirmMyPassword}
                onChange={(e) => setConfirmMyPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={busy || !newMyPassword}
                onClick={() => void saveMyPassword()}
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                Update Password
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Admin Team &amp; Handover</h2>
            <p className="text-sm text-muted-foreground">
              Add the official Outlook account or a successor admin, reset passwords, force log out sessions, or remove outgoing access.
            </p>
          </div>
          <Button size="sm" className="rounded-full" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Add Admin Account
          </Button>
        </div>

        <div className="space-y-2">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5"
            >
              <div>
                <p className="font-medium text-sm">
                  {a.email}{" "}
                  {a.is_current && (
                    <span className="ml-1 rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      You
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(a.created_at).toLocaleDateString()} · Last sign-in:{" "}
                  {a.last_sign_in_at ? new Date(a.last_sign_in_at).toLocaleString() : "Never"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={busy}
                  onClick={() => {
                    setPwTarget(a);
                    setTargetPw("");
                  }}
                >
                  <KeyRound className="mr-1 h-3.5 w-3.5" />
                  Password
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={busy}
                  onClick={() => void handleSignOutUser(a)}
                >
                  <LogOut className="mr-1 h-3.5 w-3.5" />
                  Log out
                </Button>
                {!a.is_current && accounts.length > 1 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full"
                    disabled={busy}
                    onClick={() => void handleRemoveAdmin(a)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Need to change a vendor&apos;s password or log a vendor out?{" "}
          <Link to="/admin/vendors" className="font-semibold text-primary underline">
            Open Vendor Management
          </Link>
          .
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">2FA Email Delivery (Outlook / Resend)</h2>
            <p className="text-sm text-muted-foreground">
              Used by Finance &amp; Payment 2FA so verification codes are sent strictly to your recovery email inbox instead of showing on screen.
            </p>
          </div>
          <Link
            to="/admin/finance"
            className="text-xs font-semibold text-primary underline"
          >
            Open Finance Security →
          </Link>
        </div>

        {emailStatus?.configured ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-3">
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email delivery connected via {emailStatus.provider === "smtp" ? "SMTP" : "Resend"}
              </p>
              <p className="mt-1 text-xs">Sender: {emailStatus.fromLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                type="email"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="Recipient email (leave blank for Finance Recovery Email)"
                className="max-w-sm bg-white text-foreground"
              />
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={testingEmail}
                onClick={() => void handleSendTestEmail()}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {testingEmail ? "Sending…" : "Send Test Email"}
              </Button>
            </div>
            {testEmailFeedback && (
              <div
                className={
                  "rounded-lg border p-3 text-xs " +
                  (testEmailFeedback.ok
                    ? "border-emerald-300 bg-white text-emerald-900"
                    : "border-rose-300 bg-rose-50 text-rose-900")
                }
              >
                {testEmailFeedback.message}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 space-y-2">
            <p className="text-sm font-semibold">Email delivery is not configured on the server yet</p>
            <p>
              To send real 2FA codes to your email inbox, add these variables in{" "}
              <strong>Vercel → Project Settings → Environment Variables</strong> and redeploy:
            </p>
            <div className="rounded-lg bg-white/80 p-3 font-mono text-[11px] leading-relaxed text-foreground">
              <p className="font-semibold">Option A — Gmail App Password (easiest):</p>
              <p>SMTP_HOST=smtp.gmail.com</p>
              <p>SMTP_PORT=587</p>
              <p>SMTP_USER=your-email@gmail.com</p>
              <p>SMTP_PASS=your-16-letter-google-app-password</p>
              <p>SMTP_FROM=CGCC Cafeteria Express &lt;your-email@gmail.com&gt;</p>
              <p className="mt-2 font-semibold">Option B — Outlook / Microsoft 365 SMTP:</p>
              <p>SMTP_HOST=smtp.office365.com</p>
              <p>SMTP_PORT=587</p>
              <p>SMTP_USER=your-cafeteria@outlook.com</p>
              <p>SMTP_PASS=your-outlook-app-password</p>
              <p>SMTP_FROM=CGCC Cafeteria Express &lt;your-cafeteria@outlook.com&gt;</p>
              <p className="mt-2 font-semibold">Option C — Resend API:</p>
              <p>RESEND_API_KEY=re_...</p>
              <p>MAIL_FROM=CGCC Cafeteria Express &lt;noreply@yourdomain.com&gt;</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin / Handover Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-admin-email">Email</Label>
              <Input
                id="new-admin-email"
                type="email"
                className="mt-1"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="cafeteria@yourdomain.com"
              />
            </div>
            <div>
              <Label htmlFor="new-admin-pw">Initial Password (min 8 characters)</Label>
              <Input
                id="new-admin-pw"
                type="password"
                className="mt-1"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddAdmin()} disabled={busy}>
              {busy ? "Creating…" : "Create Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pwTarget !== null} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Admin Password · {pwTarget?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="target-admin-pw">New Password (min 8 characters)</Label>
            <Input
              id="target-admin-pw"
              type="password"
              value={targetPw}
              onChange={(e) => setTargetPw(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveTargetPassword()} disabled={busy}>
              Save Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ROLES: { role: string; can: string[]; never: string[] }[] = [
  {
    role: "Administrator",
    can: [
      "Manage products, categories and vendor accounts",
      "Manage payment settings and the payment gateway",
      "Manage users, reports and online inventory",
      "Delete, archive and restore orders",
      "Configure system settings and security",
    ],
    never: [],
  },
  {
    role: "Vendor",
    can: [
      "Manage online pre-order inventory: increase or reduce stock",
      "Accept orders and change status: Received → Preparing → Ready → Collected",
      "Receive new-order notifications",
      "View their own vendor reports",
    ],
    never: [
      "Change prices",
      "Add or delete products",
      "Delete or archive orders",
      "Change payment settings",
      "See data outside their own vendor scope",
      "Access system settings",
    ],
  },
  {
    role: "Customer",
    can: [
      "Browse the menu and place online pre-orders",
      "Choose Pick up now or a scheduled pickup slot",
      "Make payment and track the order",
      "View order history and download receipts",
    ],
    never: ["Any administrative access"],
  },
];

function RolePermissions() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        These permissions are enforced in the database with row-level security and role
        checks — this page documents the live rules.
      </p>
      {ROLES.map((r) => (
        <div key={r.role} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-bold">{r.role}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                Allowed
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {r.can.map((c) => (
                  <li key={c}>✓ {c}</li>
                ))}
              </ul>
            </div>
            {r.never.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-rose-700">
                  Never allowed
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {r.never.map((c) => (
                    <li key={c}>✕ {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
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

function LogoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = validateLogoFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setBusy(true);
    try {
      const url = await uploadLogoImage(file);
      onChange(url);
      toast.success(`${label} uploaded. Click “Save settings” to apply it everywhere.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider">{label}</Label>
      <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
          {value ? (
            <img src={value} alt={`${label} preview`} className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={pick}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {value ? "Replace" : "Upload logo"}
          </Button>
          {value && !busy && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full text-destructive"
              onClick={() => onChange("")}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        PNG, JPG, JPEG, SVG or WebP · up to 2MB
      </p>
    </div>
  );
}
