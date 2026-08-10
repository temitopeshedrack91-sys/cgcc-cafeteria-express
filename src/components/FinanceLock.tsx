import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { financeSessionValid, readFinanceSession } from "@/lib/finance";

/**
 * Gates a finance sub-page behind the existing Finance Security session.
 * Does not change any finance logic — it only reuses the unlock state that
 * Admin → Finance establishes.
 */
export function FinanceLock({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const sid = readFinanceSession();
      const ok = sid ? await financeSessionValid(sid).catch(() => false) : false;
      if (alive) setState(ok ? "open" : "locked");
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="p-12 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "locked") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-xl font-bold">Finance area locked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Payment settings live under Admin → Finance and require the Finance Security PIN.
        </p>
        <Button asChild className="mt-5 rounded-full">
          <Link to="/admin/finance">Unlock Finance</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
