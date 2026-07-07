export type MenuCategory =
  | "Meals"
  | "Proteins"
  | "Soups & Sides"
  | "Snacks & Pastries"
  | "Sandwiches"
  | "Small Chops"
  | "Desserts & Yogurt"
  | "Coffee & Tea"
  | "Drinks"
  | "Water"
  | "Extras";

export const CATEGORIES: MenuCategory[] = [
  "Meals",
  "Proteins",
  "Soups & Sides",
  "Snacks & Pastries",
  "Sandwiches",
  "Small Chops",
  "Desserts & Yogurt",
  "Coffee & Tea",
  "Drinks",
  "Water",
  "Extras",
];

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  description?: string;
  emoji: string;
};

export const DEFAULT_MENU: MenuItem[] = [
  // Meals
  { id: "m1", name: "Jollof Rice", price: 2500, category: "Meals", emoji: "🍚", description: "Party-style smoky jollof" },
  { id: "m2", name: "Fried Rice", price: 2500, category: "Meals", emoji: "🍛" },
  { id: "m3", name: "White Rice & Stew", price: 2200, category: "Meals", emoji: "🍚" },
  { id: "m4", name: "Ofada Rice & Sauce", price: 3000, category: "Meals", emoji: "🍲" },
  { id: "m5", name: "Amala", price: 1500, category: "Meals", emoji: "🥣" },
  { id: "m6", name: "Eba", price: 1200, category: "Meals", emoji: "🥣" },
  { id: "m7", name: "Pounded Yam", price: 1800, category: "Meals", emoji: "🥣" },

  // Proteins
  { id: "p1", name: "Grilled Chicken", price: 2500, category: "Proteins", emoji: "🍗" },
  { id: "p2", name: "Fried Chicken", price: 2500, category: "Proteins", emoji: "🍗" },
  { id: "p3", name: "Beef", price: 1500, category: "Proteins", emoji: "🥩" },
  { id: "p4", name: "Fried Fish (Titus)", price: 3000, category: "Proteins", emoji: "🐟" },
  { id: "p5", name: "Boiled Egg", price: 500, category: "Proteins", emoji: "🥚" },
  { id: "p6", name: "Turkey", price: 3500, category: "Proteins", emoji: "🦃" },

  // Soups & Sides
  { id: "s1", name: "Egusi Soup", price: 2500, category: "Soups & Sides", emoji: "🥘" },
  { id: "s2", name: "Efo Riro", price: 2500, category: "Soups & Sides", emoji: "🥬" },
  { id: "s3", name: "Ogbono Soup", price: 2500, category: "Soups & Sides", emoji: "🥘" },
  { id: "s4", name: "Okra Soup", price: 2300, category: "Soups & Sides", emoji: "🥘" },
  { id: "s5", name: "Plantain (Side)", price: 800, category: "Soups & Sides", emoji: "🍌" },
  { id: "s6", name: "Coleslaw", price: 700, category: "Soups & Sides", emoji: "🥗" },
  { id: "s7", name: "Moi Moi", price: 800, category: "Soups & Sides", emoji: "🍮" },

  // Snacks & Pastries
  { id: "sp1", name: "Meat Pie", price: 800, category: "Snacks & Pastries", emoji: "🥟" },
  { id: "sp2", name: "Chicken Pie", price: 900, category: "Snacks & Pastries", emoji: "🥟" },
  { id: "sp3", name: "Sausage Roll", price: 700, category: "Snacks & Pastries", emoji: "🌭" },
  { id: "sp4", name: "Doughnut", price: 500, category: "Snacks & Pastries", emoji: "🍩" },
  { id: "sp5", name: "Scotch Egg", price: 900, category: "Snacks & Pastries", emoji: "🥚" },
  { id: "sp6", name: "Chin Chin (Cup)", price: 500, category: "Snacks & Pastries", emoji: "🍪" },

  // Sandwiches
  { id: "sw1", name: "Chicken Sandwich", price: 2500, category: "Sandwiches", emoji: "🥪" },
  { id: "sw2", name: "Club Sandwich", price: 3000, category: "Sandwiches", emoji: "🥪" },
  { id: "sw3", name: "Egg Sandwich", price: 1500, category: "Sandwiches", emoji: "🥪" },
  { id: "sw4", name: "Tuna Sandwich", price: 2800, category: "Sandwiches", emoji: "🥪" },

  // Small Chops
  { id: "sc1", name: "Puff Puff (6 pcs)", price: 800, category: "Small Chops", emoji: "🍡" },
  { id: "sc2", name: "Samosa (4 pcs)", price: 1000, category: "Small Chops", emoji: "🥟" },
  { id: "sc3", name: "Spring Roll (4 pcs)", price: 1000, category: "Small Chops", emoji: "🥠" },
  { id: "sc4", name: "Peppered Gizzard", price: 2000, category: "Small Chops", emoji: "🍢" },
  { id: "sc5", name: "Small Chops Combo", price: 3500, category: "Small Chops", emoji: "🍡" },

  // Desserts & Yogurt
  { id: "d1", name: "Vanilla Ice Cream", price: 1500, category: "Desserts & Yogurt", emoji: "🍨" },
  { id: "d2", name: "Chocolate Cake Slice", price: 1800, category: "Desserts & Yogurt", emoji: "🍰" },
  { id: "d3", name: "Greek Yogurt", price: 1200, category: "Desserts & Yogurt", emoji: "🥛" },
  { id: "d4", name: "Fruit Parfait", price: 2000, category: "Desserts & Yogurt", emoji: "🍧" },

  // Coffee & Tea
  { id: "ct1", name: "Espresso", price: 1200, category: "Coffee & Tea", emoji: "☕" },
  { id: "ct2", name: "Cappuccino", price: 1800, category: "Coffee & Tea", emoji: "☕" },
  { id: "ct3", name: "Café Latte", price: 1800, category: "Coffee & Tea", emoji: "☕" },
  { id: "ct4", name: "English Tea", price: 800, category: "Coffee & Tea", emoji: "🍵" },
  { id: "ct5", name: "Green Tea", price: 900, category: "Coffee & Tea", emoji: "🍵" },
  { id: "ct6", name: "Hot Chocolate", price: 1500, category: "Coffee & Tea", emoji: "☕" },

  // Drinks
  { id: "dr1", name: "Coca-Cola", price: 500, category: "Drinks", emoji: "🥤" },
  { id: "dr2", name: "Fanta", price: 500, category: "Drinks", emoji: "🥤" },
  { id: "dr3", name: "Sprite", price: 500, category: "Drinks", emoji: "🥤" },
  { id: "dr4", name: "Chapman", price: 1500, category: "Drinks", emoji: "🍹" },
  { id: "dr5", name: "Zobo", price: 800, category: "Drinks", emoji: "🍷" },
  { id: "dr6", name: "Fresh Juice", price: 1500, category: "Drinks", emoji: "🧃" },
  { id: "dr7", name: "Smoothie", price: 2000, category: "Drinks", emoji: "🥤" },

  // Water
  { id: "w1", name: "Bottled Water (50cl)", price: 300, category: "Water", emoji: "💧" },
  { id: "w2", name: "Bottled Water (75cl)", price: 500, category: "Water", emoji: "💧" },
  { id: "w3", name: "Sparkling Water", price: 1200, category: "Water", emoji: "💦" },

  // Extras
  { id: "e1", name: "Takeaway Pack", price: 300, category: "Extras", emoji: "🥡" },
  { id: "e2", name: "Extra Stew", price: 500, category: "Extras", emoji: "🥣" },
  { id: "e3", name: "Extra Sauce", price: 300, category: "Extras", emoji: "🥫" },
  { id: "e4", name: "Cutlery Pack", price: 100, category: "Extras", emoji: "🍴" },
  { id: "e5", name: "Nylon Bag", price: 100, category: "Extras", emoji: "🛍️" },
];
