import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { AppFooter, AppHeader } from "@/components/AppShell";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

async function clearPwaCachesAndUpdate() {
  if (typeof window === "undefined") return;
  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    }
  } catch {
    // Best-effort cleanup
  }
}

function isChunkOrModuleError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /dynamically imported module|loading chunk|loading css chunk|failed to fetch|import.*module/i.test(
    msg,
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const isStaleBundle = isChunkOrModuleError(error);

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    if (isStaleBundle && typeof window !== "undefined") {
      try {
        const last = Number(sessionStorage.getItem("cgcc-pwa-recover-at") || "0");
        if (Date.now() - last > 15_000) {
          sessionStorage.setItem("cgcc-pwa-recover-at", String(Date.now()));
          void clearPwaCachesAndUpdate().then(() => window.location.reload());
        }
      } catch {
        // Ignore sessionStorage restrictions
      }
    }
  }, [error, isStaleBundle]);

  async function handleRetry() {
    await clearPwaCachesAndUpdate();
    if (isStaleBundle && typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    router.invalidate();
    reset();
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  async function handleGoHome() {
    await clearPwaCachesAndUpdate();
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isStaleBundle
            ? "A newer version of the app is available. Tap Try again to refresh."
            : "Something went wrong."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => void handleRetry()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => void handleGoHome()}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CGCC Cafeteria Express — Skip the Queue. Enjoy More Time." },
      {
        name: "description",
        content:
          "Pre-order your meals before arriving at the CGCC Cafeteria. Make payment, receive your order code and pick up without waiting in line.",
      },
      { property: "og:title", content: "CGCC Cafeteria Express — Skip the Queue. Enjoy More Time." },
      {
        property: "og:description",
        content: "Pre-order your meals before arriving at the CGCC Cafeteria. Make payment, receive your order code and pick up without waiting in line.",
      },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#211f1c" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "CGCC Express" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CGCC Cafeteria Express — Skip the Queue. Enjoy More Time." },
      { name: "twitter:description", content: "Pre-order your meals before arriving at the CGCC Cafeteria. Make payment, receive your order code and pick up without waiting in line." },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPreloadError = () => {
      try {
        const last = Number(sessionStorage.getItem("cgcc-pwa-recover-at") || "0");
        if (Date.now() - last > 15_000) {
          sessionStorage.setItem("cgcc-pwa-recover-at", String(Date.now()));
          void clearPwaCachesAndUpdate().then(() => window.location.reload());
        }
      } catch {
        window.location.reload();
      }
    };
    window.addEventListener("vite:preloadError", onPreloadError);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => reg.update().catch(() => undefined))
        .catch((err) => {
          console.warn("[pwa] service worker registration failed", err);
        });
    }

    return () => {
      window.removeEventListener("vite:preloadError", onPreloadError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <AppFooter />
      </div>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
