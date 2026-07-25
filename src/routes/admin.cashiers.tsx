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
  CASHIER_USERNAMES,
  initCashiers,
  listCashiers,
  setCashierActive,
  setCashierPassword,
  updateCashierEmail,
  type CashierRow,
  type CashierUsername,
} from "@/lib/cashiers.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cashiers")({
  head: () => ({
    meta: [{ title: "Cashier Management · CGCC Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <CashierManagement />
      </AdminShell>
    </AdminGuard>
  ),
});

function CashierManagement() {
  const [rows, setRows] = useState<CashierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pwDialog, setPwDialog] = useState<CashierUsername | null>(null);
  const [newPw, setNewPw] = useState("");
  const [emails, setEmails] = useState<Record<CashierUsername, string>>({ cashier1: "", cashier2: "" });
  const [savingEmail, setSavingEmail] = useState<CashierUsername | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCashiers();
      setRows(data);
      const emailMap: Record<string, string> = {};
      for (const r of data) emailMap[r.username] = r.email;
      setEmails(emailMap as Record<CashierUsername, string>);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load cashiers");
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
      const res = await initCashiers();
      if (res.created.length) toast.success(`Created ${res.created.length} cashier account(s)`);
      else toast.info("Cashier accounts already exist");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: CashierUsername, active: boolean) {
    try {
      await setCashierActive({ data: { username: u, active } });
      toast.success(active ? "Cashier activated" : "Cashier deactivated");
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
      await setCashierPassword({ data: { username: pwDialog, password: newPw } });
      toast.success("Password updated");
      setPwDialog(null);
      setNewPw("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  const missing = CASHIER_USERNAMES.filter((u) => !rows.some((r) => r.username === u && r.user_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Cashier Management</h1>
          <p className="text-sm text-muted-foreground">
            Create cashier accounts, change passwords, activate or deactivate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={"mr-1 h-4 w-4 " + (loading ? "animate-spin" : "")} /> Refresh
          </Button>
          {missing.length > 0 && (
            <Button size="sm" onClick={runInit} disabled={busy}>
              <ShieldCheck className="mr-1 h-4 w-4" />
              {busy ? "Setting up…" : `Create ${missing.length} cashier account(s)`}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.username} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold uppercase">{r.username}</p>
                <p className="text-sm text-muted-foreground">Email: <span className="font-mono">{r.email}</span></p>
              </div>
              <span
                className={
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase " +
                  (r.active
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                    : "bg-destructive/20 text-destructive border-destructive/40")
                }
              >
                {r.user_id ? (r.active ? "Active" : "Inactive") : "Not created"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Last sign-in: {r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : "Never"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setPwDialog(r.username)} disabled={!r.user_id}>
                <KeyRound className="mr-1 h-3.5 w-3.5" /> Change Password
              </Button>
              <Button
                size="sm"
                variant={r.active ? "destructive" : "default"}
                disabled={!r.user_id}
                onClick={() => void toggleActive(r.username, !r.active)}
              >
                <Power className="mr-1 h-3.5 w-3.5" />
                {r.active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={pwDialog !== null} onOpenChange={(o) => !o && setPwDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password · {pwDialog}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pw">New password (min 8 chars)</Label>
            <Input id="pw" type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Enter new password" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialog(null)}>Cancel</Button>
            <Button onClick={savePassword}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
