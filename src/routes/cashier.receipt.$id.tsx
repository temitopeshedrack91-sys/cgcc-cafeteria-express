import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { CashierShell } from "@/components/CashierShell";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/store";
import { listCashierSales, paymentLabel, type CashierSale } from "@/lib/cashier-sales";
import { downloadCashierReceiptPdf } from "@/lib/cashier-receipt-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/cashier/receipt/$id")({
  head: () => ({
    meta: [
      { title: "Cashier Receipt · CGCC Cafeteria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <CashierShell>
      <ReceiptView />
    </CashierShell>
  ),
});

function ReceiptView() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState<CashierSale | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await listCashierSales(500);
        const found = list.find((s) => s.id === id || s.code === id) ?? null;
        setSale(found);
        if (!found) toast.error("Receipt not found");
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load receipt");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!sale) return;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("autoprint") === "1") {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [sale]);

  function printReceipt() {
    window.print();
  }

  if (loading) return <p className="p-6 text-center text-sm text-muted-foreground">Loading receipt…</p>;
  if (!sale)
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Receipt not found.</p>
        <Button className="mt-3" variant="outline" asChild>
          <Link to="/cashier/receipts">Back to receipts</Link>
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/cashier/receipts" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={printReceipt}>
            <Printer className="mr-1 h-4 w-4" /> Print Receipt
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadCashierReceiptPdf(sale)}>
            <Download className="mr-1 h-4 w-4" /> Download PDF
          </Button>
          <Button size="sm" variant="outline" onClick={printReceipt}>
            <Printer className="mr-1 h-4 w-4" /> Reprint
          </Button>
        </div>
      </div>

      <ThermalReceipt sale={sale} />

      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body * { visibility: hidden; }
          .print-receipt, .print-receipt * { visibility: visible; }
          .print-receipt { position: absolute; left: 0; top: 0; width: 72mm; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export function ThermalReceipt({ sale }: { sale: CashierSale }) {
  const d = new Date(sale.created_at);
  return (
    <div
      className="print-receipt mx-auto max-w-[320px] rounded-lg border border-border bg-white p-4 font-mono text-[12px] text-black shadow-soft"
      style={{ lineHeight: 1.35 }}
    >
      <div className="text-center">
        <p className="text-sm font-bold uppercase">CGCC Cafeteria Express</p>
        <p className="text-[10px]">Walk-in Sale Receipt</p>
      </div>
      <div className="my-2 border-y border-dashed border-black py-1 text-[11px]">
        <div className="flex justify-between">
          <span>Code</span>
          <span>{sale.code}</span>
        </div>
        <div className="flex justify-between">
          <span>Receipt</span>
          <span>{sale.receipt_no}</span>
        </div>
        <div className="flex justify-between">
          <span>Date</span>
          <span>{d.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Cashier</span>
          <span>{sale.cashier_label ?? "cashier"}</span>
        </div>
        <div className="flex justify-between">
          <span>Payment</span>
          <span>{paymentLabel(sale.payment_method)}</span>
        </div>
        {sale.customer_name ? (
          <div className="flex justify-between">
            <span>Customer</span>
            <span>{sale.customer_name}</span>
          </div>
        ) : null}
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th className="text-left">Item</th>
            <th className="text-center">Qty</th>
            <th className="text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((it) => (
            <tr key={it.menu_item_id}>
              <td className="align-top">{it.name}</td>
              <td className="text-center">{it.qty}</td>
              <td className="text-right">{formatNaira(it.price * it.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 border-t border-dashed border-black pt-1">
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>{formatNaira(sale.total)}</span>
        </div>
      </div>
      {sale.note ? <p className="mt-2 text-[10px] italic">Note: {sale.note}</p> : null}
      <p className="mt-3 text-center text-[10px]">Thank you — see you again!</p>
    </div>
  );
}
