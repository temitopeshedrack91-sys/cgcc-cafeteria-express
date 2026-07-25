import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAuditLog, type AuditEntry } from "@/lib/admin-ops";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [{ title: "Audit Log · CGCC Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <AuditPage />
      </AdminShell>
    </AdminGuard>
  ),
});

function AuditPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAuditLog(500));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(s) ||
        (r.user_label ?? "").toLowerCase().includes(s) ||
        (r.entity_id ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Every important action, user, and time.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search action, user, entity…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Date · Time</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Entity</th>
              <th className="px-3 py-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No log entries.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs">{r.user_label ?? r.user_id ?? "system"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.entity_type}
                    {r.entity_id ? ` · ${r.entity_id}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <code className="whitespace-pre-wrap break-words">{JSON.stringify(r.details)}</code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
