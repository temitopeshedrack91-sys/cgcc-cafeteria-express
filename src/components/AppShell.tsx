import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { Logo } from "./Logo";
import { useStore } from "@/lib/store";

export function AppHeader() {
  const cartCount = useStore((s) => s.cart.reduce((n, c) => n + c.qty, 0));
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onAdmin = /^\/(admin|vendor|cashier)(\/|$)/.test(pathname);
  if (onAdmin) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-lg">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-9 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/cart"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition hover:opacity-90"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground shadow">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function AppFooter() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (/^\/(admin|vendor|cashier)(\/|$)/.test(pathname)) return null;
  return (
    <footer className="mt-16 border-t border-border/60 bg-primary text-primary-foreground/80">
      <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm">
        <p className="font-display text-lg text-brand">CGCC Cafeteria Express</p>
        <p className="mt-1 text-primary-foreground/60">
          © {new Date().getFullYear()} The Citadel Global Community Church
        </p>
        <div className="mt-3">
          <Link to="/schema-setup" className="text-xs text-brand/90 hover:underline">
            Database Setup SQL Script
          </Link>
        </div>
      </div>
    </footer>
  );
}
