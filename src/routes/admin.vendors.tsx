import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createVendorAccount,
  initVendors,
  listVendors,
  resetVendorPassword,
  setVendorActive,
  setVendorLabel,
  setVendorPassword,
  setVendorPermission,
  signOutVendorSessions,
  updateVendorSection,
  VENDOR_TYPES,
  type VendorType,
} from "@/lib/vendors.functions";
import { listCategories, upsertCategory, type CategoryRow } from "@/lib/admin-ops";
import { formatVendorSectionLabel, slugifyVendorKey, vendorKeyForCategoryName } from "@/lib/customer-categories";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Management · CGCC Admin" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Manage CGCC vendor accounts, rotating brands, passwords and permissions." },
      { property: "og:title", content: "Vendor Management · CGCC Admin" },
      { property: "og:description", content: "Manage CGCC vendor accounts, rotating brands, passwords and permissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <VendorManagement />
      </AdminShell>
    </AdminGuard>
  ),
});

type VendorRow = {
  id: string;
  vendor_type: VendorType;
  username: string;
  display_label: string | null;
  login_email: string | null;
  can_manage_stock: boolean;
  can_increase_stock: boolean;
  can_reduce_stock: boolean;
  can_reallocate_stock: boolean;
  can_update_preparation: boolean;
  active: boolean;
  last_login: string | null;
  created_at: string;
};

function label(v: VendorRow, categories: CategoryRow[]) {
  return v.display_label ?? `${formatVendorSectionLabel(v.vendor_type, { categories })} Vendor`;
}

function VendorManagement() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [pwDialog, setPwDialog] = useState<VendorRow | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [labelDialog, setLabelDialog] = useState<VendorRow | null>(null);
  const [newLabel, setNewLabel] = useState("");

  const [sectionDialog, setSectionDialog] = useState<VendorRow | null>(null);
  const [editSection, setEditSection] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<string>("food");
  const [customSectionMode, setCustomSectionMode] = useState(false);
  const [customSectionName, setCustomSectionName] = useState("");
  const [alsoCreateCategory, setAlsoCreateCategory] = useState(true);
  const [addUsername, setAddUsername] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addLabel, setAddLabel] = useState("");

  const [tempPwDialog, setTempPwDialog] = useState<{
    vendor: string;
    password: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, cats] = await Promise.all([listVendors(), listCategories(false)]);
      setRows(data as VendorRow[]);
      setCategories(cats);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load vendor accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const availableSections = useMemo(() => {
    const map = new Map<string, string>();
    for (const vt of VENDOR_TYPES) {
      map.set(vt, formatVendorSectionLabel(vt, { categories }));
    }
    for (const c of categories) {
      const key = vendorKeyForCategoryName(c.name);
      if (key) map.set(key, c.name);
    }
    for (const r of rows) {
      const key = r.vendor_type?.trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, formatVendorSectionLabel(key, { categories }));
      }
    }
    return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
  }, [categories, rows]);

  async function runInit() {
    setBusy(true);
    try {
      const res = await initVendors();
      if (res.created.length) {
        toast.success(`Created ${res.created.length} vendor account(s)`);
      } else {
        toast.info("All default vendor accounts already exist");
      }
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(v: VendorRow, next: boolean) {
    try {
      await setVendorActive({ data: { vendorId: v.id, active: next } });
      toast.success(next ? "Account activated" : "Account deactivated");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function togglePermission(
    v: VendorRow,
    permission: "can_increase_stock" | "can_reduce_stock" | "can_reallocate_stock" | "can_update_preparation",
    next: boolean,
  ) {
    try {
      await setVendorPermission({ data: { vendorId: v.id, permission, enabled: next } });
      toast.success("Permission updated");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update permission");
    }
  }

  async function savePassword() {
    if (!pwDialog) return;
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await setVendorPassword({ data: { vendorId: pwDialog.id, password: newPw } });
      toast.success("Vendor password updated and existing sessions signed out.");
      setPwDialog(null);
      setNewPw("");
      setConfirmPw("");
      setShowPw(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function saveLabel() {
    if (!labelDialog) return;
    if (newLabel.trim().length < 2) {
      toast.error("Enter a name of at least 2 characters");
      return;
    }
    try {
      await setVendorLabel({ data: { vendorId: labelDialog.id, label: newLabel.trim() } });
      toast.success("Name updated");
      setLabelDialog(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function saveSection() {
    if (!sectionDialog) return;
    const clean = slugifyVendorKey(editSection);
    if (clean.length < 2) {
      toast.error("Select or enter a valid section key");
      return;
    }
    try {
      await updateVendorSection({ data: { vendorId: sectionDialog.id, vendorType: clean } });
      toast.success("Vendor section updated");
      setSectionDialog(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update section");
    }
  }

  async function resetPassword(v: VendorRow) {
    try {
      const res = await resetVendorPassword({ data: { vendorId: v.id } });
      setTempPwDialog({ vendor: label(v, categories), password: res.temporaryPassword });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function forceSignOutVendor(v: VendorRow) {
    try {
      await signOutVendorSessions({ data: { vendorId: v.id } });
      toast.success(`${label(v, categories)} signed out across all devices.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to sign out vendor");
    }
  }

  async function submitAdd() {
    const resolvedSection = customSectionMode
      ? slugifyVendorKey(customSectionName)
      : addType.trim().toLowerCase();

    if (resolvedSection.length < 2) {
      toast.error("Select an existing section or enter a new section name");
      return;
    }
    if (addUsername.trim().length < 2 || !addEmail.includes("@") || addLabel.trim().length < 2) {
      toast.error("Fill in brand/display name, username and a valid email");
      return;
    }
    setBusy(true);
    try {
      if (customSectionMode && alsoCreateCategory && customSectionName.trim().length >= 2) {
        const exists = categories.some(
          (c) =>
            c.name.trim().toLowerCase() === customSectionName.trim().toLowerCase() ||
            vendorKeyForCategoryName(c.name) === resolvedSection,
        );
        if (!exists) {
          await upsertCategory({ name: customSectionName.trim() });
        }
      }
      const res = await createVendorAccount({
        data: {
          vendorType: resolvedSection,
          username: addUsername.trim(),
          email: addEmail.trim(),
          label: addLabel.trim(),
        },
      });
      setAddOpen(false);
      setAddUsername("");
      setAddEmail("");
      setAddLabel("");
      setCustomSectionMode(false);
      setCustomSectionName("");
      setTempPwDialog({ vendor: `${addLabel.trim()} (${res.email})`, password: res.temporaryPassword });
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setBusy(false);
    }
  }

  const missing = VENDOR_TYPES.filter(
    (vt) => !rows.some((r) => r.vendor_type === vt),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Vendor Management</h1>
          <p className="text-sm text-muted-foreground">
            Create unlimited vendor logins across any category or custom section (e.g. Queen&apos;s Ward, Snack Vendor 2), rotate monthly brands with Active/Inactive switches, and manage permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={"mr-1 h-4 w-4 " + (loading ? "animate-spin" : "")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-1 h-4 w-4" /> Add Vendor Account
          </Button>
          {missing.length > 0 && (
            <Button size="sm" variant="outline" onClick={runInit} disabled={busy}>
              <ShieldCheck className="mr-1 h-4 w-4" />
              {busy ? "Setting up…" : `Create ${missing.length} default account(s)`}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
          Loading vendor accounts…
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">
            No vendor accounts yet. Use &quot;Add Vendor Account&quot; above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((v) => {
            const sectionLabel = formatVendorSectionLabel(v.vendor_type, { categories, vendors: rows });
            return (
              <div
                key={v.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold">{label(v, categories)}</p>
                    <p className="text-sm text-muted-foreground">
                      Section: <span className="font-medium text-foreground">{sectionLabel}</span> · Username:{" "}
                      <span className="font-mono">{v.username}</span>
                    </p>
                    {v.login_email && (
                      <p className="text-xs text-muted-foreground">
                        Login email: <span className="font-mono">{v.login_email}</span>
                      </p>
                    )}
                  </div>
                  <span
                    className={
                      "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase " +
                      (v.active
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-destructive/20 text-destructive border-destructive/40")
                    }
                  >
                    {v.active ? "Active" : "Inactive"}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <dt className="uppercase">Created</dt>
                    <dd className="text-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase">Last login</dt>
                    <dd className="text-foreground">
                      {v.last_login ? new Date(v.last_login).toLocaleString() : "Never"}
                    </dd>
                  </div>
                  {(
                    [
                      ["can_increase_stock", "Increase stock"],
                      ["can_reduce_stock", "Reduce stock"],
                      ["can_update_preparation", "Update preparation status"],
                    ] as const
                  ).map(([permission, title]) => (
                    <div key={permission} className="col-span-2 flex items-center justify-between gap-3 border-t border-border py-2">
                      <dt className="text-foreground">{title}</dt>
                      <Switch
                        checked={v[permission] && (permission === "can_update_preparation" || v.can_manage_stock)}
                        onCheckedChange={(next) => void togglePermission(v, permission, Boolean(next))}
                        aria-label={`${title} for ${label(v, categories)}`}
                      />
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setLabelDialog(v);
                      setNewLabel(label(v, categories));
                    }}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSectionDialog(v);
                      setEditSection(v.vendor_type);
                    }}
                  >
                    Change Section
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPwDialog(v);
                      setNewPw("");
                      setConfirmPw("");
                      setShowPw(false);
                    }}
                  >
                    <KeyRound className="mr-1 h-3.5 w-3.5" /> Change Password
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void resetPassword(v)}
                  >
                    Reset Password
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void forceSignOutVendor(v)}
                  >
                    <LogOut className="mr-1 h-3.5 w-3.5" /> Log Out
                  </Button>
                  <Button
                    size="sm"
                    variant={v.active ? "destructive" : "default"}
                    onClick={() => void toggleActive(v, !v.active)}
                  >
                    <Power className="mr-1 h-3.5 w-3.5" />
                    {v.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Change Password Dialog */}
      <Dialog
        open={pwDialog !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPwDialog(null);
            setNewPw("");
            setConfirmPw("");
            setShowPw(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change password{pwDialog ? ` · ${label(pwDialog, categories)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw">New password (min 8 chars)</Label>
              <div className="relative">
                <Input
                  id="pw"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">Confirm new password</Label>
              <Input
                id="pw-confirm"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialog(null)}>
              Cancel
            </Button>
            <Button onClick={savePassword}>Save Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={labelDialog !== null} onOpenChange={(o) => !o && setLabelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename vendor account</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lbl">Display / Brand name</Label>
            <Input
              id="lbl"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Queen's Ward Snacks"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveLabel}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Section Dialog */}
      <Dialog open={sectionDialog !== null} onOpenChange={(o) => !o && setSectionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Vendor Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Choose which category/section products and orders this vendor account can manage and export.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="edit-sec-select">Existing Section</Label>
              <select
                id="edit-sec-select"
                value={availableSections.some((s) => s.key === editSection) ? editSection : "__custom"}
                onChange={(e) => {
                  if (e.target.value !== "__custom") setEditSection(e.target.value);
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {availableSections.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name} ({s.key})
                  </option>
                ))}
                <option value="__custom">Custom section key…</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-sec-key">Section Key</Label>
              <Input
                id="edit-sec-key"
                value={editSection}
                onChange={(e) => setEditSection(e.target.value)}
                placeholder="e.g. snacks or queens_ward"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveSection}>Update Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vendor Account Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add vendor account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Category / Vendor Section</Label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary underline"
                  onClick={() => setCustomSectionMode((v) => !v)}
                >
                  <Plus className="h-3 w-3" />
                  {customSectionMode ? "Pick existing section" : "Create new section"}
                </button>
              </div>
              {!customSectionMode ? (
                <div className="flex flex-wrap gap-1.5">
                  {availableSections.map((sec) => (
                    <Button
                      key={sec.key}
                      type="button"
                      size="sm"
                      variant={addType === sec.key ? "default" : "outline"}
                      onClick={() => setAddType(sec.key)}
                    >
                      {sec.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div>
                    <Label htmlFor="new-sec-name" className="text-xs">
                      New Vendor / Category Section Name
                    </Label>
                    <Input
                      id="new-sec-name"
                      value={customSectionName}
                      onChange={(e) => setCustomSectionName(e.target.value)}
                      placeholder="e.g. Queen's Ward, Grill, or Sweets"
                      className="mt-1"
                    />
                    {customSectionName.trim() && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Section key: <span className="font-mono">{slugifyVendorKey(customSectionName)}</span>
                      </p>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={alsoCreateCategory}
                      onChange={(e) => setAlsoCreateCategory(e.target.checked)}
                    />
                    Also add as a Category on the Customer Menu
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-label">Vendor / Brand Display Name</Label>
              <Input
                id="add-label"
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                placeholder="e.g. Queen's Ward (Snacks)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-username">Login Username</Label>
              <Input
                id="add-username"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="e.g. queensward"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-email">Login Email</Label>
              <Input
                id="add-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="e.g. queensward@cgcc.local"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A temporary password is generated when the account is created — share it with the vendor. For rotating vendors, deactivate old accounts anytime without deleting past sales history.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitAdd()} disabled={busy}>
              {busy ? "Creating…" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Dialog */}
      <Dialog
        open={tempPwDialog !== null}
        onOpenChange={(o) => !o && setTempPwDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password · {tempPwDialog?.vendor}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Share this password with the vendor. It is shown only once.
          </p>
          <div className="rounded-lg border border-border bg-muted p-4 font-mono text-lg">
            {tempPwDialog?.password}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (tempPwDialog) {
                  void navigator.clipboard?.writeText(tempPwDialog.password);
                  toast.success("Copied");
                }
              }}
            >
              Copy
            </Button>
            <Button variant="outline" onClick={() => setTempPwDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
