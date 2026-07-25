import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { FileText, LogOut, ShoppingCart } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function CashierShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState<string>("Cashier");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        navigate({ to: "/cashier/login", replace: true });
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "cashier" as any)
        .maybeSingle();
      if (!role) {
        await supabase.auth.signOut();
        navigate({ to: "/cashier/login", replace: true });
        return;
      }
      if (cancelled) return;
      setLabel(user.email?.split("@")[0] ?? "Cashier");
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const nav = [
    { to: "/cashier", label: "Sales", icon: ShoppingCart },
    { to: "/cashier/receipts", label: "Receipts", icon: FileText },
  ] as const;

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/40">
        <p className="text-sm text-muted-foreground">Loading cashier dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/cashier" className="flex items-center gap-3">
            <Logo className="h-8 w-auto" />
            <span className="hidden font-display text-sm font-semibold sm:inline">
              {label.toUpperCase()}
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition " +
                    (active
                      ? "bg-brand text-brand-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground")
                  }
                >
                  <n.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{n.label}</span>
                </Link>
              );
            })}
            <Button
              size="sm"
              variant="ghost"
              className="ml-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/cashier/login" });
              }}
            >
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
