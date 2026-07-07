import logoAsset from "@/assets/cgcc_logo.png.asset.json";

export function Logo({ className = "h-10 w-auto" }: { className?: string }) {
  return <img src={logoAsset.url} alt="Citadel Global Community Church" className={className} />;
}
