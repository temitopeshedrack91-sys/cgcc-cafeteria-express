export const DEFAULT_CUSTOMER_CATEGORIES = ['Food', 'Snacks', 'Coffee & Tea', 'Drinks', 'Sweets'];

const KNOWN_CATEGORY_VENDOR_KEYS: Record<string, string> = {
  food: 'food',
  snacks: 'snacks',
  'coffee & tea': 'coffee',
  coffee: 'coffee',
  drinks: 'drinks',
};

/** 1:1 category display name (no forced legacy remapping). */
export function customerCategory(name: string): string {
  return name.trim();
}

/** Converts a vendor section or category name into a normalized vendor_type key. */
export function slugifyVendorKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

/** Resolves the default vendor_type key for a given Admin category name. */
export function vendorKeyForCategoryName(name: string): string {
  const lower = name.trim().toLowerCase();
  if (lower in KNOWN_CATEGORY_VENDOR_KEYS) {
    return KNOWN_CATEGORY_VENDOR_KEYS[lower];
  }
  return slugifyVendorKey(name) || 'food';
}

export function formatVendorSectionLabel(
  vendorKey: string,
  opts?: {
    vendors?: { vendor_type: string; display_label?: string | null; active?: boolean }[];
    categories?: { id: string; name: string }[];
  },
): string {
  const clean = vendorKey.trim().toLowerCase();
  const defaults: Record<string, string> = {
    food: 'Food',
    snacks: 'Snacks',
    coffee: 'Coffee & Tea',
    drinks: 'Drinks',
  };
  if (clean in defaults) return defaults[clean];

  const catMatch = opts?.categories?.find(
    (c) => vendorKeyForCategoryName(c.name) === clean || slugifyVendorKey(c.name) === clean,
  );
  if (catMatch) return catMatch.name;

  const activeVendor = opts?.vendors?.find((v) => v.vendor_type === clean && v.active !== false);
  if (activeVendor?.display_label) return activeVendor.display_label;

  return clean
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}