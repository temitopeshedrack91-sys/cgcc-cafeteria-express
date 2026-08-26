import { useSystemSettings } from "@/lib/settings";

/**
 * Renders the configured branding logo only. If the Admin has not uploaded a
 * Cafeteria or Church logo, nothing is rendered — no hardcoded fallback.
 */
export function Logo({ className = "h-10 w-auto" }: { className?: string }) {
  const settings = useSystemSettings();
  const src = settings.cafeteriaLogoUrl || settings.churchLogoUrl;
  if (!src) return null;
  return (
    <img
      src={src}
      alt={settings.cafeteriaName || settings.churchName || "Logo"}
      className={className}
    />
  );
}
