import { useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useOnlineStatus } from "@/hooks/use-online-status";

function IOSGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-elegant">
        <h3 id="ios-install-title" className="font-display text-lg font-bold text-foreground">
          Install CGCC Express on iPhone / iPad
        </h3>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">1.</span>
            <span>
              Tap the <strong className="inline-flex items-center gap-1 text-foreground"><Share className="h-3.5 w-3.5" /> Share</strong> button in your Safari toolbar.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">2.</span>
            <span>
              Scroll down and tap <strong className="text-foreground">Add to Home Screen</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">3.</span>
            <span>
              Tap <strong className="text-foreground">Add</strong> to install the app on your home screen.
            </span>
          </li>
        </ol>
        <Button className="mt-5 w-full rounded-full" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void install()}
        className="h-9 rounded-full border-brand/60 bg-brand/10 px-3 text-xs font-semibold text-primary hover:bg-brand/20"
      >
        <Download className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className={compact ? "hidden sm:inline" : ""}>Install App</span>
      </Button>
    );
  }

  if (isIOS) {
    return (
      <>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowIOSGuide(true)}
          className="h-9 rounded-full border-brand/60 bg-brand/10 px-3 text-xs font-semibold text-primary hover:bg-brand/20"
        >
          <Download className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className={compact ? "hidden sm:inline" : ""}>Install App</span>
        </Button>
        {showIOSGuide && <IOSGuideModal onClose={() => setShowIOSGuide(false)} />}
      </>
    );
  }

  return null;
}

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || dismissed || (!isInstallable && !isIOS)) return null;

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-3.5 shadow-soft sm:px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <Smartphone className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-primary">
                Install CGCC Cafeteria Express App
              </p>
              <p className="text-xs text-muted-foreground">
                Add to your phone home screen for one-tap ordering and instant access.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => {
                if (isInstallable) void install();
                else if (isIOS) setShowIOSGuide(true);
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download App
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Dismiss install banner"
              className="h-8 w-8 rounded-full"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {showIOSGuide && <IOSGuideModal onClose={() => setShowIOSGuide(false)} />}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
      Offline Mode — Cached menu is shown.
    </div>
  );
}
