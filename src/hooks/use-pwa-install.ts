import { useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

const PWA_SESSION_KEY = "cgcc-pwa-standalone";
const APP_DISPLAY_MODES = [
  "(display-mode: standalone)",
  "(display-mode: fullscreen)",
  "(display-mode: minimal-ui)",
  "(display-mode: window-controls-overlay)",
] as const;

let savedPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

export function detectInstalledPWA(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("pwa") === "1" || sp.get("source") === "pwa") {
      try {
        sessionStorage.setItem(PWA_SESSION_KEY, "1");
      } catch {
        // Ignore sessionStorage errors
      }
      return true;
    }

    try {
      if (sessionStorage.getItem(PWA_SESSION_KEY) === "1") {
        return true;
      }
    } catch {
      // Ignore sessionStorage errors
    }

    if (
      typeof document !== "undefined" &&
      document.referrer.startsWith("android-app://")
    ) {
      return true;
    }

    if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) {
      return true;
    }

    if (typeof window.matchMedia === "function") {
      for (const query of APP_DISPLAY_MODES) {
        if (window.matchMedia(query).matches) {
          return true;
        }
      }
    }
  } catch {
    // Ignore detection errors
  }
  return false;
}

if (typeof window !== "undefined") {
  if (window.__pwaInstallPrompt) {
    savedPrompt = window.__pwaInstallPrompt;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    savedPrompt = e as BeforeInstallPromptEvent;
    window.__pwaInstallPrompt = savedPrompt;
    promptListeners.forEach((fn) => fn(savedPrompt));
  });

  window.addEventListener("appinstalled", () => {
    savedPrompt = null;
    window.__pwaInstallPrompt = null;
    promptListeners.forEach((fn) => fn(null));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(() =>
      savedPrompt ?? (typeof window !== "undefined" ? window.__pwaInstallPrompt ?? null : null),
    );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    const syncInstalledState = () => {
      const installed = detectInstalledPWA();
      setIsInstalled(installed);
      if (installed && typeof document !== "undefined") {
        document.documentElement.dataset.pwaInstalled = "1";
        try {
          sessionStorage.setItem(PWA_SESSION_KEY, "1");
        } catch {
          // Ignore sessionStorage errors
        }
      }
    };

    syncInstalledState();

    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (ua.includes("macintosh") && "ontouchend" in document);
    setIsIOS(isIOSDevice);

    const isMobileUA = /android|iphone|ipad|ipod|mobile|tablet/.test(ua);
    setIsDesktop(!isMobileUA && !isIOSDevice);

    const earlyPrompt = savedPrompt ?? window.__pwaInstallPrompt ?? null;
    if (earlyPrompt) {
      savedPrompt = earlyPrompt;
      setDeferredPrompt(earlyPrompt);
    }

    const onPrompt = (next: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(next);
    };
    promptListeners.add(onPrompt);

    const onInstalled = () => {
      savedPrompt = null;
      window.__pwaInstallPrompt = null;
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const mediaQueries =
      typeof window.matchMedia === "function"
        ? APP_DISPLAY_MODES.map((q) => window.matchMedia(q))
        : [];
    for (const mq of mediaQueries) {
      mq.addEventListener?.("change", syncInstalledState);
    }
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      promptListeners.delete(onPrompt);
      for (const mq of mediaQueries) {
        mq.removeEventListener?.("change", syncInstalledState);
      }
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    const promptEvent = deferredPrompt ?? savedPrompt ?? window.__pwaInstallPrompt ?? null;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      savedPrompt = null;
      window.__pwaInstallPrompt = null;
      setIsInstalled(true);
      setDeferredPrompt(null);
      promptListeners.forEach((fn) => fn(null));
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isDesktop,
    isInIframe,
    install,
  };
}
