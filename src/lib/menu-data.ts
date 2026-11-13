export type MenuCategory = string;

export const CATEGORIES: MenuCategory[] = [
  "Food",
  "Snacks",
  "Coffee & Tea",
  "Drinks",
  "Sweets",
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
  // Food (Meals, Proteins, Soups & Sides, Extras, Natural Drinks)
  { id: "m1", name: "Jollof Rice", price: 600, category: "Food", image: img("jollof,rice", 101) },
  { id: "m2", name: "Fried Rice", price: 600, category: "Food", image: img("fried,rice", 102) },
  { id: "m3", name: "Ofada Rice", price: 600, category: "Food", image: img("ofada,rice", 103) },
  { id: "m4", name: "Coconut Rice", price: 700, category: "Food", image: img("coconut,rice", 104) },
  { id: "m5", name: "Amala", price: 600, category: "Food", image: img("amala,ewedu", 105) },
  { id: "m6", name: "Pounded Yam", price: 600, category: "Food", image: img("pounded,yam", 106) },
  { id: "m7", name: "Ewa Agoyin", price: 600, category: "Food", image: img("ewa,agoyin,beans", 107) },
  { id: "m8", name: "Potato Porridge", price: 650, category: "Food", image: img("potato,porridge", 108) },
  { id: "p1", name: "Chicken (Big)", price: 2000, category: "Food", image: img("grilled,chicken", 201) },
  { id: "p2", name: "Chicken (Small)", price: 1500, category: "Food", image: img("fried,chicken", 202) },
  { id: "p3", name: "Beef", price: 1000, category: "Food", image: img("beef,stew", 203) },
  { id: "p4", name: "Hake Fish (Big)", price: 2000, category: "Food", image: img("fried,fish", 204) },
  { id: "p5", name: "Hake Fish (Small)", price: 1500, category: "Food", image: img("hake,fish", 205) },
  { id: "p6", name: "Pomo", price: 400, category: "Food", image: img("pomo,cowskin", 206) },
  { id: "s1", name: "Efo Riro", price: 650, category: "Food", image: img("efo,riro,soup", 301) },
  { id: "s2", name: "Bitter Leaf Soup", price: 650, category: "Food", image: img("bitterleaf,soup", 302) },
  { id: "s3", name: "Ofada Sauce", price: 1000, category: "Food", image: img("ofada,sauce", 303) },
  { id: "s4", name: "Moi Moi", price: 800, category: "Food", image: img("moimoi,beans", 304) },
  { id: "e1", name: "Takeaway Pack", price: 250, category: "Food", image: img("takeaway,container", 1101) },
  { id: "e2", name: "Boiled Egg", price: 450, category: "Food", image: img("boiled,egg", 1102) },
  { id: "e3", name: "Salad", price: 650, category: "Food", image: img("green,salad", 1103) },
  { id: "e4", name: "Dodo", price: 400, category: "Food", image: img("fried,plantain", 1104) },
  { id: "dr8", name: "Five Alive", price: 700, category: "Food", image: img("juice,carton", 908) },
  { id: "dr11", name: "Vita Zobo (30cl)", price: 600, category: "Food", image: img("zobo,hibiscus,drink", 911) },
  { id: "dr12", name: "Vita Zobo (45cl)", price: 800, category: "Food", image: img("hibiscus,drink,bottle", 912) },
  { id: "dr13", name: "Zobo Cocktail", price: 700, category: "Food", image: img("hibiscus,cocktail", 913) },
  { id: "dr14", name: "Tigernut Milk", price: 1500, category: "Food", image: img("tigernut,milk,kunu", 914) },

  // Snacks (Pastries, Sandwiches, Small Chops, Parfait & Yogurt)
  { id: "sp1", name: "Meat Pie", price: 1000, category: "Snacks", image: img("meat,pie", 401) },
  { id: "sp2", name: "Chicken Pie", price: 1000, category: "Snacks", image: img("chicken,pie", 402) },
  { id: "sp3", name: "Sausage Roll", price: 600, category: "Snacks", image: img("sausage,roll", 403) },
  { id: "sp4", name: "Hotdog Roll", price: 800, category: "Snacks", image: img("hotdog,bun", 404) },
  { id: "sp5", name: "Egg Roll", price: 700, category: "Snacks", image: img("egg,roll,pastry", 405) },
  { id: "sp6", name: "Plain Doughnut", price: 500, category: "Snacks", image: img("plain,doughnut", 406) },
  { id: "sp7", name: "Jam Doughnut", price: 500, category: "Snacks", image: img("jam,doughnut", 407) },
  { id: "sp8", name: "Shawarma", price: 2500, category: "Snacks", image: img("shawarma,wrap", 408) },
  { id: "sp9", name: "Bread Roll", price: 450, category: "Snacks", image: img("bread,roll", 409) },
  { id: "sp10", name: "Bread Loaf", price: 2400, category: "Snacks", image: img("bread,loaf", 410) },
  { id: "sw1", name: "Chicken Sandwich", price: 1500, category: "Snacks", image: img("chicken,sandwich", 501) },
  { id: "sw2", name: "Egg Sandwich", price: 1500, category: "Snacks", image: img("egg,sandwich", 502) },
  { id: "sc1", name: "Chicken Small Chops", price: 3000, category: "Snacks", image: img("chicken,wings,platter", 601) },
  { id: "sc2", name: "Beef Small Chops", price: 2500, category: "Snacks", image: img("beef,skewers,platter", 602) },
  { id: "d1", name: "Fruit Parfait", price: 4000, category: "Snacks", image: img("fruit,parfait", 701) },
  { id: "d2", name: "Yogurt (35cl)", price: 1400, category: "Snacks", image: img("yogurt,cup", 702) },
  { id: "d3", name: "Yogurt (50cl)", price: 2500, category: "Snacks", image: img("yogurt,bottle", 703) },
  { id: "d4", name: "Yogurt (1L)", price: 3500, category: "Snacks", image: img("yogurt,drink", 704) },

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

  // Drinks (Carbonated Drinks & Water)
  { id: "dr1", name: "Coca-Cola (PET)", price: 500, category: "Drinks", image: img("coca,cola,bottle", 901) },
  { id: "dr2", name: "Pepsi (PET)", price: 500, category: "Drinks", image: img("pepsi,bottle", 902) },
  { id: "dr3", name: "Coca-Cola (Glass/Solo)", price: 300, category: "Drinks", image: img("coca,cola,glass", 903) },
  { id: "dr4", name: "Malta Guinness", price: 800, category: "Drinks", image: img("malta,guinness", 904) },
  { id: "dr5", name: "Maltina", price: 800, category: "Drinks", image: img("maltina,malt", 905) },
  { id: "dr6", name: "Amstel Malt", price: 800, category: "Drinks", image: img("amstel,malt", 906) },
  { id: "dr7", name: "Schweppes", price: 600, category: "Drinks", image: img("schweppes,soda", 907) },
  { id: "dr9", name: "Viju Apple", price: 700, category: "Drinks", image: img("apple,milk,drink", 909) },
  { id: "dr10", name: "Viju Chocolate", price: 1200, category: "Drinks", image: img("chocolate,milk", 910) },
  { id: "w1", name: "Nestlé Water", price: 200, category: "Drinks", image: img("bottled,water", 1001) },
  { id: "w2", name: "CWAY Water", price: 200, category: "Drinks", image: img("water,bottle", 1002) },
];
