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

let savedPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

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
    const media = window.matchMedia("(display-mode: standalone)");
    const checkStandalone = () =>
      media.matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsInstalled(checkStandalone());

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

    const onDisplayModeChange = () => {
      setIsInstalled(checkStandalone());
    };

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

    media.addEventListener?.("change", onDisplayModeChange);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      promptListeners.delete(onPrompt);
      media.removeEventListener?.("change", onDisplayModeChange);
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
