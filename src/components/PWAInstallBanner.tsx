import { useEffect, useState } from "react";
import { Download, MoreVertical, Share, Smartphone, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useOnlineStatus } from "@/hooks/use-online-status";

function InstallGuideModal({
  isIOS,
  onClose,
}: {
  isIOS: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-guide-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-elegant">
        <div className="flex items-start justify-between gap-2">
          <h3 id="pwa-install-guide-title" className="font-display text-lg font-bold text-foreground">
            {isIOS ? "Install on iPhone / iPad" : "Install CGCC Cafeteria Express"}
          </h3>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="-mr-2 -mt-1 h-8 w-8 rounded-full"
            onClick={onClose}
            aria-label="Close install instructions"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {isIOS ? (
          <ol className="mt-3 space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary">1.</span>
              <span>
                Tap the{" "}
                <strong className="inline-flex items-center gap-1 text-foreground">
                  <Share className="h-3.5 w-3.5" /> Share
                </strong>{" "}
                button in your Safari toolbar.
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
                Tap <strong className="text-foreground">Add</strong> to install the app icon.
              </span>
            </li>
          </ol>
        ) : (
          <ol className="mt-3 space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary">1.</span>
              <span>
                Tap the{" "}
                <strong className="inline-flex items-center gap-0.5 text-foreground">
                  <MoreVertical className="h-3.5 w-3.5" /> menu
                </strong>{" "}
                icon at the top-right corner of your browser.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary">2.</span>
              <span>
                Tap <strong className="text-foreground">Install app</strong> or{" "}
                <strong className="text-foreground">Add to Home screen</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary">3.</span>
              <span>
                Tap <strong className="text-foreground">Install</strong> — the app will open full-screen from your phone menu.
              </span>
            </li>
          </ol>
        )}
        <Button className="mt-5 w-full rounded-full" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Only hide when the user is already inside the installed standalone app.
  if (isInstalled) return null;

  async function handleClick() {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) return;
      return;
    }
    setShowGuide(true);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void handleClick()}
        className="h-9 rounded-full border-brand/60 bg-brand/10 px-3 text-xs font-semibold text-primary hover:bg-brand/20"
      >
        <Download className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className={compact ? "hidden sm:inline" : ""}>Install App</span>
      </Button>
      {showGuide && <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />}
    </>
  );
}

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Always show whenever opening in a browser (unless already running as installed standalone app or dismissed this visit).
  if (isInstalled || dismissed) return null;

  async function handleDownloadClick() {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  }

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
                Add to your phone home screen for one-tap online pre-ordering.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => void handleDownloadClick()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {isInstallable ? "Install App" : "Download App"}
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
      {showGuide && <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuide(false)} />}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isOnline) setDismissed(false);
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-700" />
      <span>You are offline — showing saved menu. Reconnect to place an order.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-1 rounded p-0.5 text-amber-800 hover:bg-amber-200/60"
        aria-label="Dismiss offline message"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
