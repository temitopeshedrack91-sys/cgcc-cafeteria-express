import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { actions, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

const SIDEBAR_STORAGE_KEY = "cgcc-admin-sidebar-collapsed";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/products", label: "Products & Categories", icon: Package },
  { to: "/admin/menu", label: "Live Menu", icon: UtensilsCrossed },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/vendors", label: "Vendors", icon: Users },
  { to: "/admin/payouts", label: "Payouts", icon: HandCoins },
  { to: "/admin/finance", label: "Finance & 2FA", icon: ShieldCheck },
  { to: "/admin/audit", label: "Audit Log", icon: ClipboardList },
  { to: "/admin/settings", label: "System Settings", icon: Settings },
] as const;

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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  async function handleLogout() {
    await actions.adminLogout();
    navigate({ to: "/admin/login" });
  }

  const normalizedPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isHome = normalizedPath === "/admin";
  const currentNav = NAV_ITEMS.find((n) => n.to === normalizedPath) ?? NAV_ITEMS[0];

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/admin" });
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Desktop collapsible sidebar */}
      <aside
        className={
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:sticky md:top-0 md:flex md:h-screen " +
          (collapsed ? "w-[68px]" : "w-[248px]")
        }
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
          {!collapsed && (
            <Link to="/admin" className="flex items-center gap-2.5 overflow-hidden">
              <Logo className="h-7 w-auto shrink-0" />
              <span className="truncate font-display text-sm font-semibold whitespace-nowrap">
                CGCC Admin
              </span>
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground " +
              (collapsed ? "mx-auto" : "")
            }
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => {
            const active = normalizedPath === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap " +
                  (collapsed ? "justify-center " : "") +
                  (active
                    ? "bg-brand text-brand-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground")
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={() => void handleLogout()}
            title={collapsed ? "Logout" : undefined}
            className={
              "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground whitespace-nowrap " +
              (collapsed ? "justify-center" : "")
            }
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <Link to="/admin" className="flex items-center gap-2.5">
                <Logo className="h-7 w-auto" />
                <span className="font-display text-sm font-semibold">CGCC Admin</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="grid h-9 w-9 place-items-center rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
              {NAV_ITEMS.map((item) => {
                const active = normalizedPath === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap " +
                      (active
                        ? "bg-brand text-brand-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground")
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-sidebar-border p-3">
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={() => void handleLogout()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground md:hidden">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="grid h-9 w-9 place-items-center rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/admin" className="flex items-center gap-2">
              <Logo className="h-7 w-auto" />
              <span className="font-display text-sm font-semibold whitespace-nowrap">
                {currentNav.label}
              </span>
            </Link>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={() => void handleLogout()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">
          {!isHome && (
            <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <span aria-hidden="true">/</span>
              <Link to="/admin" className="hover:text-foreground">
                Admin
              </Link>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-foreground">{currentNav.label}</span>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
