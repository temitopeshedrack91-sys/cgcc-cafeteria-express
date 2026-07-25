import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNaira } from "@/lib/store";
import {
  VENDOR_LABELS,
  computeReport,
  rangeFor,
  type DateRangeKey,
  type ReportOrder,
  type ReportScope,
} from "@/lib/reports";
import { downloadReportPdf } from "@/lib/report-pdf";
import { downloadReportXlsx } from "@/lib/report-xlsx";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: ReportScope;
  orders: ReportOrder[];
};

const RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "custom", label: "Custom" },
];

export function ReportDialog({ open, onOpenChange, scope, orders }: Props) {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("today");
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const report = useMemo(() => {
    const custom =
      rangeKey === "custom"
        ? {
            from: new Date(from + "T00:00:00").getTime(),
            to: new Date(to + "T00:00:00").getTime() + 24 * 3600 * 1000,
          }
        : undefined;
    const r = rangeFor(rangeKey, custom);
    return computeReport({
      orders,
      scope,
      from: r.from,
      to: r.to,
      rangeLabel: r.label,
    });
  }, [orders, scope, rangeKey, from, to]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>End of Day Report — {VENDOR_LABELS[scope]}</DialogTitle>
          <DialogDescription>
            Live totals. Updates automatically as new orders arrive.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={rangeKey === r.key ? "default" : "outline"}
              onClick={() => setRangeKey(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>

        {rangeKey === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Received" value={String(report.ordersReceived)} />
          <Stat label="Completed" value={String(report.ordersCompleted)} />
          <Stat label="Pending" value={String(report.ordersPending)} />
          <Stat label="Cancelled" value={String(report.ordersCancelled)} />
          <Stat label="Items Sold" value={String(report.itemsSold)} />
          <Stat label="Collected" value={String(report.collected)} />
          <Stat label="Not Collected" value={String(report.notCollected)} />
          <Stat label="Revenue" value={formatNaira(report.revenue)} highlight />
        </div>

        <div className="max-h-52 overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                <th className="p-2">Product</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {report.productSummary.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-muted-foreground">
                    No items in range.
                  </td>
                </tr>
              ) : (
                report.productSummary.map((p) => (
                  <tr key={p.name} className="border-t border-border">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2 text-right font-semibold">{p.qty}</td>
                    <td className="p-2 text-right">{formatNaira(p.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => downloadReportXlsx(report)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Download Excel
          </Button>
          <Button onClick={() => downloadReportPdf(report)}>
            <FileText className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border border-border p-2 " +
        (highlight ? "bg-primary text-primary-foreground" : "bg-card")
      }
    >
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
