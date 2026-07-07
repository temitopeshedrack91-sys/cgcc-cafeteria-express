import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { LayoutDashboard, LogOut, UtensilsCrossed } from "lucide-react";
import { Logo } from "./Logo";
import { actions, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function AdminGuard({ children }: { children: ReactNode }) {
  const loggedIn = useStore((s) => s.adminLoggedIn);
  const navigate = useNavigate();
  useEffect(() => {
    if (!loggedIn) navigate({ to: "/admin/login", replace: true });
  }, [loggedIn, navigate]);
  if (!loggedIn) return null;
  return <>{children}</>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const nav = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  ] as const;

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/admin" className="flex items-center gap-3">
            <Logo className="h-8 w-auto" />
            <span className="hidden font-display text-sm font-semibold sm:inline">
              Admin
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
              onClick={() => {
                actions.adminLogout();
                navigate({ to: "/admin/login" });
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
