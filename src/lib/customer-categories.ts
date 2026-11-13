export const CUSTOMER_CATEGORIES = ['Food', 'Snacks', 'Coffee & Tea', 'Drinks', 'Sweets'];
const LEGACY_GROUPS: Record<string, string> = {
  Meals: 'Food',
  Proteins: 'Food',
  'Soups & Sides': 'Food',
  Extras: 'Food',
  'Snacks & Pastries': 'Snacks',
  Sandwiches: 'Snacks',
  'Small Chops': 'Snacks',
  'Desserts & Yogurt': 'Snacks',
  Water: 'Drinks',
};
export function customerCategory(name: string): string {
  return LEGACY_GROUPS[name] ?? name;
}