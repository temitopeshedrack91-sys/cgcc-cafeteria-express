import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Power, RefreshCw, ShieldCheck } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  initVendors,
  listVendors,
  resetVendorPassword,
  setVendorActive,
  setVendorPassword,
  VENDOR_TYPES,
  type VendorType,
} from "@/lib/vendors.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Management · CGCC Admin" },
      { name: "robots", content: "noindex" },
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

const LABELS: Record<VendorType, string> = {
  food: "Food Vendor",
  snacks: "Snacks Vendor",
  coffee: "Coffee Vendor",
  drinks: "Drinks Vendor (Cafeteria Management)",
};

type VendorRow = {
  vendor_type: VendorType;
  username: string;
  active: boolean;
  last_login: string | null;
  created_at: string;
};

function VendorManagement() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pwDialog, setPwDialog] = useState<VendorType | null>(null);
  const [newPw, setNewPw] = useState("");
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
      toast.error(e.message ?? "Failed to load vendors");
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
        toast.info("All vendor accounts already exist");
      }
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(vt: VendorType, next: boolean) {
    try {
      await setVendorActive({ data: { vendorType: vt, active: next } });
      toast.success(next ? "Vendor activated" : "Vendor deactivated");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function savePassword() {
    if (!pwDialog) return;
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      await setVendorPassword({ data: { vendorType: pwDialog, password: newPw } });
      toast.success("Password updated");
      setPwDialog(null);
      setNewPw("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function resetPassword(vt: VendorType) {
    try {
      const res = await resetVendorPassword({ data: { vendorType: vt } });
      setTempPwDialog({ vendor: LABELS[vt], password: res.temporaryPassword });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
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
            Activate vendors, change passwords, and reset credentials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={"mr-1 h-4 w-4 " + (loading ? "animate-spin" : "")} />
            Refresh
          </Button>
          {missing.length > 0 && (
            <Button size="sm" onClick={runInit} disabled={busy}>
              <ShieldCheck className="mr-1 h-4 w-4" />
              {busy ? "Setting up…" : `Create ${missing.length} vendor account(s)`}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
          Loading vendors…
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">
            No vendor accounts yet. Click "Create vendor accounts" above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((v) => (
            <div
              key={v.vendor_type}
              className="rounded-2xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold">{LABELS[v.vendor_type]}</p>
                  <p className="text-sm text-muted-foreground">
                    Username: <span className="font-mono">{v.username}</span>
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
                <div className="col-span-2">
                  <dt className="uppercase">Password</dt>
                  <dd className="font-mono">••••••••</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setPwDialog(v.vendor_type)}>
                  <KeyRound className="mr-1 h-3.5 w-3.5" /> Change Password
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void resetPassword(v.vendor_type)}
                >
                  Reset Password
                </Button>
                <Button
                  size="sm"
                  variant={v.active ? "destructive" : "default"}
                  onClick={() => void toggleActive(v.vendor_type, !v.active)}
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
              Change password{pwDialog ? ` · ${LABELS[pwDialog]}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pw">New password (min 8 chars)</Label>
            <Input
              id="pw"
              type="text"
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

      <Dialog
        open={tempPwDialog !== null}
        onOpenChange={(o) => !o && setTempPwDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password · {tempPwDialog?.vendor}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Share this password with the vendor and ask them to change it via
            Vendor Management after they sign in.
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
