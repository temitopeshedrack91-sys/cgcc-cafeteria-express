import logoAsset from "@/assets/cgcc_logo.png.asset.json";
import { useSystemSettings } from "@/lib/settings";

export function Logo({ className = "h-10 w-auto" }: { className?: string }) {
  const settings = useSystemSettings();
  const src = settings.cafeteriaLogoUrl || settings.churchLogoUrl || logoAsset.url;
  return (
    <img
      src={src}
      alt={settings.cafeteriaName || "Citadel Global Community Church"}
      className={className}
    />
  );
}
