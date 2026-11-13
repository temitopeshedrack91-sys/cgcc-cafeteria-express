import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { AdminGuard, AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/cashiers")({
  head: () => ({
    meta: [
      ...pageMeta("Cashier Disabled · CGCC Admin", "Walk-in cashier sales are disengaged."),
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell>
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-800">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">
            Walk-In Cashier Module Disabled
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            CGCC Cafeteria Express operates strictly for online pre-orders and scheduled pickup. Walk-in counter sales and cashier accounts are disengaged.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/admin">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Dashboard
              </Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link to="/admin/vendors">Manage Vendors</Link>
            </Button>
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  ),
});
