import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Save, Building2, ShieldCheck, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_SETTINGS,
  WEEKDAYS,
  loadSettings,
  saveSettings,
  type SystemSettings,
} from "@/lib/settings";
import { uploadLogoImage, validateLogoFile } from "@/lib/admin-ops";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "System Settings · CGCC Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <SystemSettingsPage />
      </AdminShell>
    </AdminGuard>
  ),
});

type Tab = "general" | "roles";

function SystemSettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">System Settings</h1>
        <p className="text-sm text-muted-foreground">
          Central control panel. Everything here is stored in the database and applies
          across the app immediately — no code changes needed.
        </p>
      </div>

      <div className="mb-6 inline-flex rounded-full border border-border bg-card p-1">
        <TabBtn active={tab === "general"} onClick={() => setTab("general")} icon={Building2}>
          General
        </TabBtn>
        <TabBtn active={tab === "roles"} onClick={() => setTab("roles")} icon={ShieldCheck}>
          Role permissions
        </TabBtn>
      </div>

      {tab === "general" ? <GeneralSettings /> : <RolePermissions />}
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
        <Field label="Pickup Time Interval (minutes)">
          <Input type="number" min={5} step={5} {...bindNumber("pickupIntervalMinutes")} />
        </Field>
        <Field label="Maximum Pickup Time (minutes ahead)">
          <Input type="number" min={15} step={15} {...bindNumber("maxPickupMinutes")} />
        </Field>
      </Section>

      <Section title="Messages">
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

const ROLES: { role: string; can: string[]; never: string[] }[] = [
  {
    role: "Administrator",
    can: [
      "Manage products, categories, vendors and cashiers",
      "Manage payment settings and the payment gateway",
      "Manage users, reports and inventory",
      "Delete, archive and restore orders",
      "Configure system settings and security",
    ],
    never: [],
  },
  {
    role: "Vendor",
    can: [
      "Manage inventory: add, reduce and move stock between Walk-in and Online",
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
    role: "Cashier",
    can: [
      "Process walk-in sales",
      "Print, reprint and view receipts",
      "Close daily sales",
      "View only their own sales",
    ],
    never: [
      "Change prices",
      "Add, edit or delete products",
      "Modify inventory",
      "Modify payment settings",
      "Access system settings",
      "Delete orders",
    ],
  },
  {
    role: "Customer",
    can: [
      "Browse the menu and place orders",
      "Choose a pickup time",
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
