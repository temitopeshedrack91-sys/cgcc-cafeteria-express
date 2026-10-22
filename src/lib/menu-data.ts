export type MenuCategory = string;
type LegacyMenuCategory =
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
  image: string;
};

// Placeholder food photography via LoremFlickr (real Flickr photos, tag-matched,
// locked seeds so each item keeps a stable image). Easy to swap for real
// CGCC cafeteria photos later — just replace the `image` URL per item.
const img = (tags: string, lock: number) =>
  `https://loremflickr.com/600/450/${encodeURIComponent(tags)}/all?lock=${lock}`;

export const DEFAULT_MENU: MenuItem[] = [
  // Meals
  { id: "m1", name: "Jollof Rice", price: 600, category: "Meals", image: img("jollof,rice", 101) },
  { id: "m2", name: "Fried Rice", price: 600, category: "Meals", image: img("fried,rice", 102) },
  { id: "m3", name: "Ofada Rice", price: 600, category: "Meals", image: img("ofada,rice", 103) },
  { id: "m4", name: "Coconut Rice", price: 700, category: "Meals", image: img("coconut,rice", 104) },
  { id: "m5", name: "Amala", price: 600, category: "Meals", image: img("amala,ewedu", 105) },
  { id: "m6", name: "Pounded Yam", price: 600, category: "Meals", image: img("pounded,yam", 106) },
  { id: "m7", name: "Ewa Agoyin", price: 600, category: "Meals", image: img("ewa,agoyin,beans", 107) },
  { id: "m8", name: "Potato Porridge", price: 650, category: "Meals", image: img("potato,porridge", 108) },

  // Proteins
  { id: "p1", name: "Chicken (Big)", price: 2000, category: "Proteins", image: img("grilled,chicken", 201) },
  { id: "p2", name: "Chicken (Small)", price: 1500, category: "Proteins", image: img("fried,chicken", 202) },
  { id: "p3", name: "Beef", price: 1000, category: "Proteins", image: img("beef,stew", 203) },
  { id: "p4", name: "Hake Fish (Big)", price: 2000, category: "Proteins", image: img("fried,fish", 204) },
  { id: "p5", name: "Hake Fish (Small)", price: 1500, category: "Proteins", image: img("hake,fish", 205) },
  { id: "p6", name: "Pomo", price: 400, category: "Proteins", image: img("pomo,cowskin", 206) },

  // Soups & Sides
  { id: "s1", name: "Efo Riro", price: 650, category: "Soups & Sides", image: img("efo,riro,soup", 301) },
  { id: "s2", name: "Bitter Leaf Soup", price: 650, category: "Soups & Sides", image: img("bitterleaf,soup", 302) },
  { id: "s3", name: "Ofada Sauce", price: 1000, category: "Soups & Sides", image: img("ofada,sauce", 303) },
  { id: "s4", name: "Moi Moi", price: 800, category: "Soups & Sides", image: img("moimoi,beans", 304) },

  // Snacks & Pastries
  { id: "sp1", name: "Meat Pie", price: 1000, category: "Snacks & Pastries", image: img("meat,pie", 401) },
  { id: "sp2", name: "Chicken Pie", price: 1000, category: "Snacks & Pastries", image: img("chicken,pie", 402) },
  { id: "sp3", name: "Sausage Roll", price: 600, category: "Snacks & Pastries", image: img("sausage,roll", 403) },
  { id: "sp4", name: "Hotdog Roll", price: 800, category: "Snacks & Pastries", image: img("hotdog,bun", 404) },
  { id: "sp5", name: "Egg Roll", price: 700, category: "Snacks & Pastries", image: img("egg,roll,pastry", 405) },
  { id: "sp6", name: "Plain Doughnut", price: 500, category: "Snacks & Pastries", image: img("plain,doughnut", 406) },
  { id: "sp7", name: "Jam Doughnut", price: 500, category: "Snacks & Pastries", image: img("jam,doughnut", 407) },
  { id: "sp8", name: "Shawarma", price: 2500, category: "Snacks & Pastries", image: img("shawarma,wrap", 408) },
  { id: "sp9", name: "Bread Roll", price: 450, category: "Snacks & Pastries", image: img("bread,roll", 409) },
  { id: "sp10", name: "Bread Loaf", price: 2400, category: "Snacks & Pastries", image: img("bread,loaf", 410) },

  // Sandwiches
  { id: "sw1", name: "Chicken Sandwich", price: 1500, category: "Sandwiches", image: img("chicken,sandwich", 501) },
  { id: "sw2", name: "Egg Sandwich", price: 1500, category: "Sandwiches", image: img("egg,sandwich", 502) },

  // Small Chops
  { id: "sc1", name: "Chicken Small Chops", price: 3000, category: "Small Chops", image: img("chicken,wings,platter", 601) },
  { id: "sc2", name: "Beef Small Chops", price: 2500, category: "Small Chops", image: img("beef,skewers,platter", 602) },

  // Desserts & Yogurt
  { id: "d1", name: "Fruit Parfait", price: 4000, category: "Desserts & Yogurt", image: img("fruit,parfait", 701) },
  { id: "d2", name: "Yogurt (35cl)", price: 1400, category: "Desserts & Yogurt", image: img("yogurt,cup", 702) },
  { id: "d3", name: "Yogurt (50cl)", price: 2500, category: "Desserts & Yogurt", image: img("yogurt,bottle", 703) },
  { id: "d4", name: "Yogurt (1L)", price: 3500, category: "Desserts & Yogurt", image: img("yogurt,drink", 704) },

  // Coffee & Tea
  { id: "ct1", name: "Cappuccino", price: 700, category: "Coffee & Tea", image: img("cappuccino", 801) },
  { id: "ct2", name: "Caffè Latte", price: 700, category: "Coffee & Tea", image: img("cafe,latte", 802) },
  { id: "ct3", name: "Coffee with Cream", price: 650, category: "Coffee & Tea", image: img("coffee,cream", 803) },
  { id: "ct4", name: "Hot Chocolate", price: 650, category: "Coffee & Tea", image: img("hot,chocolate", 804) },
  { id: "ct5", name: "Hot Chocolate & Cream", price: 650, category: "Coffee & Tea", image: img("hot,chocolate,cream", 805) },
  { id: "ct6", name: "Black Coffee", price: 500, category: "Coffee & Tea", image: img("black,coffee", 806) },
  { id: "ct7", name: "Black Coffee & Cream", price: 650, category: "Coffee & Tea", image: img("coffee,cup", 807) },
  { id: "ct8", name: "Green Tea", price: 1000, category: "Coffee & Tea", image: img("green,tea", 808) },
  { id: "ct9", name: "Peppermint Tea", price: 1000, category: "Coffee & Tea", image: img("peppermint,tea", 809) },
  { id: "ct10", name: "Orange & Spice Tea", price: 1000, category: "Coffee & Tea", image: img("orange,spice,tea", 810) },
  { id: "ct11", name: "Lemon Tea", price: 1000, category: "Coffee & Tea", image: img("lemon,tea", 811) },
  { id: "ct12", name: "Lemon Ginger Tea", price: 1000, category: "Coffee & Tea", image: img("lemon,ginger,tea", 812) },

  // Drinks
  { id: "dr1", name: "Coca-Cola (PET)", price: 500, category: "Drinks", image: img("coca,cola,bottle", 901) },
  { id: "dr2", name: "Pepsi (PET)", price: 500, category: "Drinks", image: img("pepsi,bottle", 902) },
  { id: "dr3", name: "Coca-Cola (Glass/Solo)", price: 300, category: "Drinks", image: img("coca,cola,glass", 903) },
  { id: "dr4", name: "Malta Guinness", price: 800, category: "Drinks", image: img("malta,guinness", 904) },
  { id: "dr5", name: "Maltina", price: 800, category: "Drinks", image: img("maltina,malt", 905) },
  { id: "dr6", name: "Amstel Malt", price: 800, category: "Drinks", image: img("amstel,malt", 906) },
  { id: "dr7", name: "Schweppes", price: 600, category: "Drinks", image: img("schweppes,soda", 907) },
  { id: "dr8", name: "Five Alive", price: 700, category: "Drinks", image: img("juice,carton", 908) },
  { id: "dr9", name: "Viju Apple", price: 700, category: "Drinks", image: img("apple,milk,drink", 909) },
  { id: "dr10", name: "Viju Chocolate", price: 1200, category: "Drinks", image: img("chocolate,milk", 910) },
  { id: "dr11", name: "Vita Zobo (30cl)", price: 600, category: "Drinks", image: img("zobo,hibiscus,drink", 911) },
  { id: "dr12", name: "Vita Zobo (45cl)", price: 800, category: "Drinks", image: img("hibiscus,drink,bottle", 912) },
  { id: "dr13", name: "Zobo Cocktail", price: 700, category: "Drinks", image: img("hibiscus,cocktail", 913) },
  { id: "dr14", name: "Tigernut Milk", price: 1500, category: "Drinks", image: img("tigernut,milk,kunu", 914) },

  // Water
  { id: "w1", name: "Nestlé Water", price: 200, category: "Water", image: img("bottled,water", 1001) },
  { id: "w2", name: "CWAY Water", price: 200, category: "Water", image: img("water,bottle", 1002) },

  // Extras
  { id: "e1", name: "Takeaway Pack", price: 250, category: "Extras", image: img("takeaway,container", 1101) },
  { id: "e2", name: "Boiled Egg", price: 450, category: "Extras", image: img("boiled,egg", 1102) },
  { id: "e3", name: "Salad", price: 650, category: "Extras", image: img("green,salad", 1103) },
  { id: "e4", name: "Dodo", price: 400, category: "Extras", image: img("fried,plantain", 1104) },
];
