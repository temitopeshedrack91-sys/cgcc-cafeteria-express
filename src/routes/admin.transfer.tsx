import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Landmark,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { FinanceLock } from "@/components/FinanceLock";
import { PaymentStatusCard } from "@/components/PaymentStatusCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  deleteBankAccount,
  listBankAccounts,
  reorderBankAccounts,
  saveBankAccount,
  setBankAccountArchived,
  setBankAccountEnabled,
  setDefaultBankAccount,
  type BankAccount,
} from "@/lib/bank-accounts";
import {
  DEFAULT_TRANSFER_SETTINGS,
  loadTransferSettings,
  saveTransferSettings,
  type TransferSettings,
} from "@/lib/transfer-settings";
import { uploadLogoImage, validateLogoFile, logAudit } from "@/lib/admin-ops";

export const Route = createFileRoute("/admin/transfer")({
  head: () => ({
    meta: [
      { title: "Manual Bank Transfer · CGCC Admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Manage bank accounts, transfer instructions and payment verification.",
      },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <FinanceLock>
          <TransferPage />
        </FinanceLock>
      </AdminShell>
    </AdminGuard>
  ),
});

type Draft = {
  id?: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  enabled: boolean;
  logo_url: string | null;
  instructions: string;
  narration: string;
};

const EMPTY_DRAFT: Draft = {
  bank_name: "",
  account_name: "",
  account_number: "",
  enabled: true,
  logo_url: null,
  instructions: "",
  narration: "",
};

function TransferPage() {
  const [rows, setRows] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TransferSettings>(DEFAULT_TRANSFER_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [accounts, cfg] = await Promise.all([listBankAccounts(true), loadTransferSettings(true)]);
      setRows(accounts);
      setSettings(cfg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load bank accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await saveTransferSettings(settings);
      toast.success("Transfer settings saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function submitDraft() {
    if (!draft) return;
    if (!draft.bank_name.trim() || !draft.account_name.trim() || !draft.account_number.trim()) {
      toast.error("Bank name, account name and account number are required.");
      return;
    }
    setSaving(true);
    try {
      await saveBankAccount({
        ...(draft.id ? { id: draft.id } : {}),
        bank_name: draft.bank_name,
        account_name: draft.account_name,
        account_number: draft.account_number,
        enabled: draft.enabled,
        logo_url: draft.logo_url,
        instructions: draft.instructions,
        narration: draft.narration,
      });
      await logAudit(draft.id ? "bank.update" : "bank.create", "bank_account", draft.id ?? draft.bank_name, {
        bank: draft.bank_name,
        account_number: draft.account_number,
      });
      toast.success(draft.id ? "Bank account updated." : "Bank account added.");
      setDraft(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the account.");
    } finally {
      setSaving(false);
    }
  }

  async function pickLogo(file: File) {
    const invalid = validateLogoFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadLogoImage(file);
      setDraft((d) => (d ? { ...d, logo_url: url } : d));
      toast.success("Logo uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...rows];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    setRows(next);
    try {
      await reorderBankAccounts(next.map((r) => r.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder accounts.");
      await refresh();
    }
  }

  async function act(fn: () => Promise<void>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Manual Bank Transfer</h1>
          <p className="text-sm text-muted-foreground">
            Runs completely independently of the online gateway. Customers can always
            pay by transfer while this is enabled.
          </p>
        </div>
        <Button className="rounded-full" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
          <Plus className="mr-2 h-4 w-4" />
          Add bank account
        </Button>
      </div>

      <div className="mb-6">
        <PaymentStatusCard compact />
      </div>

      {/* Global transfer settings */}
      <div className="mb-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Customer transfer experience</h2>
        <Toggle
          label="Bank transfer enabled"
          hint="Turn off to hide the transfer option from customers."
          checked={settings.enabled}
          onChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
        />
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider">
            Payment instructions
          </Label>
          <Textarea
            className="mt-1"
            rows={3}
            value={settings.instructions}
            onChange={(e) => setSettings((s) => ({ ...s, instructions: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider">
            Transfer narration instructions
          </Label>
          <Textarea
            className="mt-1"
            rows={2}
            value={settings.narration}
            onChange={(e) => setSettings((s) => ({ ...s, narration: e.target.value }))}
          />
        </div>
        <Toggle
          label="Ask for transfer reference"
          hint="Customer types the bank reference after paying."
          checked={settings.requireReference}
          onChange={(v) => setSettings((s) => ({ ...s, requireReference: v }))}
        />
        <Toggle
          label="Allow proof-of-payment upload"
          hint="Customer can attach a receipt screenshot."
          checked={settings.requireProof}
          onChange={(v) => setSettings((s) => ({ ...s, requireProof: v }))}
        />
        <Toggle
          label="Manual verification required"
          hint="Staff confirm payment before the order is prepared."
          checked={settings.manualVerification}
          onChange={(v) => setSettings((s) => ({ ...s, manualVerification: v }))}
        />
        <div className="flex justify-end border-t border-border pt-4">
          <Button className="rounded-full" onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save transfer settings
          </Button>
        </div>
      </div>

      {/* Draft editor */}
      {draft && (
        <div className="mb-6 space-y-4 rounded-2xl border-2 border-brand/40 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">
              {draft.id ? "Edit bank account" : "New bank account"}
            </h2>
            <Button size="icon" variant="ghost" onClick={() => setDraft(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank name">
              <Input
                value={draft.bank_name}
                onChange={(e) => setDraft({ ...draft, bank_name: e.target.value })}
              />
            </Field>
            <Field label="Account name">
              <Input
                value={draft.account_name}
                onChange={(e) => setDraft({ ...draft, account_name: e.target.value })}
              />
            </Field>
            <Field label="Account number">
              <Input
                inputMode="numeric"
                value={draft.account_number}
                onChange={(e) => setDraft({ ...draft, account_number: e.target.value })}
              />
            </Field>
            <Field label="Bank logo">
              <div className="flex items-center gap-3">
                {draft.logo_url ? (
                  <img
                    src={draft.logo_url}
                    alt="Bank logo"
                    className="h-10 w-10 rounded-lg border border-border object-contain"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  {draft.logo_url ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void pickLogo(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {draft.logo_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraft({ ...draft, logo_url: null })}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </Field>
          </div>
          <Field label="Account-specific instructions (optional)">
            <Textarea
              rows={2}
              value={draft.instructions}
              onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
            />
          </Field>
          <Field label="Account-specific narration (optional)">
            <Input
              value={draft.narration}
              onChange={(e) => setDraft({ ...draft, narration: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Toggle
              label="Enabled"
              checked={draft.enabled}
              onChange={(v) => setDraft({ ...draft, enabled: v })}
            />
            <Button className="rounded-full" onClick={submitDraft} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {draft.id ? "Save changes" : "Add account"}
            </Button>
          </div>
        </div>
      )}

      {/* Accounts list */}
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No bank accounts yet. Add one so customers can pay by transfer.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className={`rounded-2xl border bg-card p-4 shadow-soft ${
                r.archived_at ? "border-dashed opacity-60" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {r.logo_url ? (
                    <img
                      src={r.logo_url}
                      alt={r.bank_name}
                      className="h-10 w-10 rounded-lg border border-border object-contain"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Landmark className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold">
                      {r.bank_name}
                      {r.is_default && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Star className="h-3 w-3" /> Default
                        </span>
                      )}
                      {r.archived_at && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {r.account_name} · {r.account_number}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => void move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void move(i, 1)}
                    disabled={i === rows.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) =>
                      act(() => setBankAccountEnabled(r.id, v), v ? "Account enabled." : "Account disabled.")
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        id: r.id,
                        bank_name: r.bank_name,
                        account_name: r.account_name,
                        account_number: r.account_number,
                        enabled: r.enabled,
                        logo_url: r.logo_url,
                        instructions: r.instructions ?? "",
                        narration: r.narration ?? "",
                      })
                    }
                  >
                    Edit
                  </Button>
                  {!r.is_default && !r.archived_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act(() => setDefaultBankAccount(r.id), "Default account updated.")}
                    >
                      <Star className="mr-1 h-3.5 w-3.5" /> Default
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      act(
                        () => setBankAccountArchived(r.id, !r.archived_at),
                        r.archived_at ? "Account restored." : "Account archived.",
                      )
                    }
                  >
                    {r.archived_at ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (!confirm(`Delete ${r.bank_name} permanently?`)) return;
                      void act(() => deleteBankAccount(r.id), "Account deleted.");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {(r.instructions || r.narration) && (
                <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                  {r.instructions} {r.narration}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
