import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";

/**
 * Walk-in / counter POS module is disengaged: CGCC Cafeteria Express is
 * strictly for online pre-orders and scheduled pickup.
 */
export function CashierShell(_props: { children?: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-elegant">
        <div className="mx-auto flex flex-col items-center">
          <Logo className="h-12 w-auto" />
          <div className="mt-5 grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-800">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">
            Walk-In Cashier Disabled
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            CGCC Cafeteria Express is configured for online pre-orders and scheduled pickup only. Walk-in counter sales are handled outside this app.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild className="rounded-full">
              <Link to="/">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Online Menu
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/admin/login">Admin Login</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
