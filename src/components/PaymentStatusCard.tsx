// Live payment status card — gateway, mode, transfer and last transactions.
import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadPaymentStatus, type PaymentStatusSnapshot, type Health } from "@/lib/payment/health";

const DOT: Record<Health, string> = { healthy: "🟢", warning: "🟡", error: "🔴" };

export function PaymentStatusCard({ compact = false }: { compact?: boolean }) {
  const [snap, setSnap] = useState<PaymentStatusSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      setSnap(await loadPaymentStatus());
    } catch {
      setSnap(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (!snap) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Payment status</h2>
        <Button size="sm" variant="outline" className="rounded-full" onClick={refresh} disabled={busy}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Row
          label="Gateway Status"
          value={`${DOT[snap.gatewayHealth]} ${snap.config.enabled ? "Enabled" : "Disabled"}`}
        />
        <Row
          label="Environment"
          value={snap.config.mode === "live" ? "Live" : "Test Mode (sandbox)"}
        />
        <Row label="Provider" value={snap.providerName} />
        <Row label="Gateway Health" value={`${DOT[snap.gatewayHealth]} ${snap.gatewayMessage}`} />
        <Row
          label="Transfer Status"
          value={`${DOT[snap.transferHealth]} ${snap.transfer.enabled ? "Enabled" : "Disabled"}`}
        />
        <Row
          label="Active Bank Account"
          value={
            snap.defaultAccount
              ? `${snap.defaultAccount.bank_name} — ${snap.defaultAccount.account_number}`
              : "Not configured"
          }
        />
        {!compact && (
          <>
            <Row label="Webhook Status" value={`${DOT[snap.webhookHealth]} ${snap.webhookMessage}`} />
            <Row label="Last Successful Payment" value={fmtTxn(snap.lastSuccess)} />
            <Row label="Last Failed Payment" value={fmtTxn(snap.lastFailed)} />
            <Row
              label="Last Synchronisation"
              value={snap.lastSync ? new Date(snap.lastSync).toLocaleString() : "None yet"}
            />
          </>
        )}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}
