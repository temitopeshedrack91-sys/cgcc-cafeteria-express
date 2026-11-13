import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, Power, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
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
  VENDOR_TYPES,
  VENDOR_TYPE_LABELS,
  type VendorType,
} from "@/lib/vendors.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Management · CGCC Admin" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Manage CGCC vendor accounts, passwords and permissions." },
      { property: "og:title", content: "Vendor Management · CGCC Admin" },
      { property: "og:description", content: "Manage CGCC vendor accounts, passwords and permissions." },
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
  can_manage_stock: boolean;
  can_increase_stock: boolean;
  can_reduce_stock: boolean;
  can_reallocate_stock: boolean;
  can_update_preparation: boolean;
  active: boolean;
  last_login: string | null;
  created_at: string;
};

function label(v: VendorRow) {
  return v.display_label ?? `${VENDOR_TYPE_LABELS[v.vendor_type]} Vendor`;
}

function VendorManagement() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pwDialog, setPwDialog] = useState<VendorRow | null>(null);
  const [newPw, setNewPw] = useState("");
  const [labelDialog, setLabelDialog] = useState<VendorRow | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<VendorType>("food");
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
      const data = await listVendors();
      setRows(data as VendorRow[]);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load vendor accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    } catch (e: any) {
      toast.error(e.message ?? "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(v: VendorRow, next: boolean) {
    try {
      await setVendorActive({ data: { vendorId: v.id, active: next } });
      toast.success(next ? "Account activated" : "Account deactivated");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function togglePermission(v: VendorRow, permission: 'can_increase_stock' | 'can_reduce_stock' | 'can_reallocate_stock' | 'can_update_preparation', next: boolean) {
    try {
      await setVendorPermission({ data: { vendorId: v.id, permission, enabled: next } });
      toast.success("Permission updated");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not update permission");
    }
  }

  async function savePassword() {
    if (!pwDialog) return;
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      await setVendorPassword({ data: { vendorId: pwDialog.id, password: newPw } });
      toast.success("Password updated");
      setPwDialog(null);
      setNewPw("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
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
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function resetPassword(v: VendorRow) {
    try {
      const res = await resetVendorPassword({ data: { vendorId: v.id } });
      setTempPwDialog({ vendor: label(v), password: res.temporaryPassword });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function submitAdd() {
    if (addUsername.trim().length < 2 || !addEmail.includes("@") || addLabel.trim().length < 2) {
      toast.error("Fill in name, username and a valid email");
      return;
    }
    setBusy(true);
    try {
      const res = await createVendorAccount({
        data: {
          vendorType: addType,
          username: addUsername.trim(),
          email: addEmail.trim(),
          label: addLabel.trim(),
        },
      });
      setAddOpen(false);
      setAddUsername("");
      setAddEmail("");
      setAddLabel("");
      setTempPwDialog({ vendor: `${addLabel.trim()} (${res.email})`, password: res.temporaryPassword });
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create account");
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
            Create multiple vendor logins under Food, Snacks, Coffee, or Drinks and control permissions from here.
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
            No vendor accounts yet. Use "Add Vendor Account" above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((v) => (
            <div
              key={v.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold">{label(v)}</p>
                  <p className="text-sm text-muted-foreground">
                    {VENDOR_TYPE_LABELS[v.vendor_type]} section · Username:{" "}
                    <span className="font-mono">{v.username}</span>
                  </p>
                </div>
                <span
                  className={
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase " +
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
                {([
                  ['can_increase_stock', 'Increase stock'],
                  ['can_reduce_stock', 'Reduce stock'],
                  ['can_update_preparation', 'Update preparation status'],
                ] as const).map(([permission, title]) => (
                  <div key={permission} className="col-span-2 flex items-center justify-between gap-3 border-t border-border py-2">
                    <dt className="text-foreground">{title}</dt>
                    <Switch
                      checked={v[permission] && (permission === 'can_update_preparation' || v.can_manage_stock)}
                      onCheckedChange={(next) => void togglePermission(v, permission, Boolean(next))}
                      aria-label={`${title} for ${label(v)}`}
                    />
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setLabelDialog(v); setNewLabel(label(v)); }}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Rename
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPwDialog(v)}>
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
                  variant={v.active ? "destructive" : "default"}
                  onClick={() => void toggleActive(v, !v.active)}
                >
                  <Power className="mr-1 h-3.5 w-3.5" />
                  {v.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={pwDialog !== null} onOpenChange={(o) => !o && setPwDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change password{pwDialog ? ` · ${label(pwDialog)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pw">New password (min 8 chars)</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialog(null)}>
              Cancel
            </Button>
            <Button onClick={savePassword}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={labelDialog !== null} onOpenChange={(o) => !o && setLabelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename vendor account</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lbl">Display name</Label>
            <Input
              id="lbl"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Food Vendor"
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

      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add vendor account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Section</Label>
              <div className="flex flex-wrap gap-2">
                {VENDOR_TYPES.map((vt) => (
                  <Button
                    key={vt}
                    size="sm"
                    variant={addType === vt ? "default" : "outline"}
                    onClick={() => setAddType(vt)}
                  >
                    {VENDOR_TYPE_LABELS[vt]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-label">Display name</Label>
              <Input
                id="add-label"
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                placeholder="e.g. Drinks Vendor 2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-username">Username</Label>
              <Input
                id="add-username"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="e.g. drinks2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Login email</Label>
              <Input
                id="add-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="e.g. drinks2@cgcc.local"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A temporary password is generated when the account is created — share it with the vendor.
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
