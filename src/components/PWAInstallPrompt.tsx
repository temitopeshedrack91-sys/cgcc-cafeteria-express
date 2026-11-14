import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useStore } from "@/lib/store";

/**
 * Floating bottom install prompt shown ONLY in customer browser sessions
 * when native one-tap install is genuinely available (or iOS Safari guide).
 * Automatically hidden inside the installed PWA, admin/vendor portals, and
 * browsers where the app is already installed or install is unsupported.
 */
export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hasCartItems = useStore((s) => s.cart.length > 0);

  const onPortalRoute = /^\/(admin|vendor|cashier)(\/|$)/.test(pathname);
  const onStickyCartRoute = hasCartItems && /^\/(menu|cart|checkout)(\/|$)/.test(pathname);
  if (onPortalRoute || onStickyCartRoute || isInstalled || isInIframe || dismissed) return null;
  if (!isInstallable && !isIOS) return null;

  async function handleInstall() {
    if (!isInstallable || installing) return;
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div
      className="pwa-install-ui fixed inset-x-0 bottom-3 z-40 mx-auto max-w-md px-3 sm:bottom-5"
      role="region"
      aria-label="Install CGCC Cafeteria Express"
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-elegant backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground">
            CGCC Cafeteria Express
          </p>
          {isInstallable ? (
            <p className="text-xs text-muted-foreground">
              Install app on your device for quick ordering
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span>Tap</span>
              <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                <Share className="h-3 w-3" /> Share
              </span>
              <span>then</span>
              <span className="font-medium text-foreground">Add to Home Screen</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isInstallable ? (
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-full px-4 text-xs font-semibold"
              disabled={installing}
              onClick={() => void handleInstall()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {installing ? "Installing…" : "Install"}
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full text-muted-foreground"
            aria-label="Dismiss install prompt"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
