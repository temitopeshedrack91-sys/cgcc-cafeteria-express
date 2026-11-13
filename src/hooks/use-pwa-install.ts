import { useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let savedPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    savedPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn(savedPrompt));
  });

  window.addEventListener("appinstalled", () => {
    savedPrompt = null;
    promptListeners.forEach((fn) => fn(null));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(() => savedPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const checkStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsInstalled(checkStandalone());

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (ua.includes("macintosh") && "ontouchend" in document);
    setIsIOS(isIOSDevice);

    const onPrompt = (next: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(next);
    };
    promptListeners.add(onPrompt);
    if (savedPrompt) setDeferredPrompt(savedPrompt);

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", onInstalled);

    return () => {
      promptListeners.delete(onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    const promptEvent = deferredPrompt ?? savedPrompt;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      savedPrompt = null;
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
    install,
  };
}
