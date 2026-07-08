import { useSyncExternalStore } from "react";
import { DEFAULT_MENU, type MenuItem } from "./menu-data";

// ============ Types ============
export type CartItem = { itemId: string; qty: number };

export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "collected";

export type Order = {
  code: string; // CG-001
  receiptNo: string;
  customerName: string;
  phone: string;
  note?: string;
  orderType: "dine-in" | "takeaway";
  items: { id: string; name: string; price: number; qty: number }[];
  total: number;
  paymentStatus: "paid" | "unpaid";
  pickupStatus: OrderStatus;
  createdAt: number;
};

type MenuState = Record<string, { available: boolean }>;

type AppState = {
  cart: CartItem[];
  menu: MenuItem[];
  menuState: MenuState;
  orders: Order[];
  orderCounter: number;
  orderingOpen: boolean;
  adminLoggedIn: boolean;
};

// ============ Storage ============
const KEY = "cgcc-cafeteria-state-v1";
const isBrowser = typeof window !== "undefined";

function load(): AppState {
  const base: AppState = {
    cart: [],
    menu: DEFAULT_MENU,
    menuState: Object.fromEntries(DEFAULT_MENU.map((m) => [m.id, { available: true }])),
    orders: [],
    orderCounter: 0,
    orderingOpen: true,
    adminLoggedIn: false,
  };
  if (!isBrowser) return base;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    // Ensure every menu item has a state entry (in case menu grew)
    const menuState = { ...base.menuState, ...(parsed.menuState ?? {}) };
    return { ...base, ...parsed, menu: DEFAULT_MENU, menuState };
  } catch {
    return base;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  if (!isBrowser) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function set(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ============ Hook ============
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function getState() {
  return state;
}

// ============ Actions ============
export const actions = {
  addToCart(itemId: string, qty = 1) {
    const cart = [...state.cart];
    const existing = cart.find((c) => c.itemId === itemId);
    if (existing) existing.qty += qty;
    else cart.push({ itemId, qty });
    set({ cart });
  },
  setQty(itemId: string, qty: number) {
    if (qty <= 0) {
      set({ cart: state.cart.filter((c) => c.itemId !== itemId) });
    } else {
      set({ cart: state.cart.map((c) => (c.itemId === itemId ? { ...c, qty } : c)) });
    }
  },
  removeFromCart(itemId: string) {
    set({ cart: state.cart.filter((c) => c.itemId !== itemId) });
  },
  clearCart() {
    set({ cart: [] });
  },
  toggleAvailable(itemId: string) {
    const cur = state.menuState[itemId]?.available ?? true;
    set({ menuState: { ...state.menuState, [itemId]: { available: !cur } } });
  },
  setOrderingOpen(open: boolean) {
    set({ orderingOpen: open });
  },
  createOrder(input: Omit<Order, "code" | "receiptNo" | "createdAt" | "pickupStatus" | "paymentStatus">): Order {
    const next = state.orderCounter + 1;
    const code = `CG-${String(next).padStart(3, "0")}`;
    const receiptNo = `R${Date.now().toString().slice(-8)}`;
    const order: Order = {
      ...input,
      code,
      receiptNo,
      createdAt: Date.now(),
      pickupStatus: "pending",
      paymentStatus: "unpaid",
    };
    set({ orders: [order, ...state.orders], orderCounter: next });
    return order;
  },
  updateOrderStatus(code: string, pickupStatus: OrderStatus) {
    set({
      orders: state.orders.map((o) => (o.code === code ? { ...o, pickupStatus } : o)),
    });
  },
  confirmPayment(code: string) {
    set({
      orders: state.orders.map((o) =>
        o.code === code ? { ...o, paymentStatus: "paid", pickupStatus: o.pickupStatus === "pending" ? "confirmed" : o.pickupStatus } : o,
      ),
    });
  },
  adminLogin() {
    set({ adminLoggedIn: true });
  },
  adminLogout() {
    set({ adminLoggedIn: false });
  },
};

// ============ Helpers ============
export function formatNaira(amount: number) {
  return "₦" + amount.toLocaleString("en-NG");
}

export function cartTotal(cart: CartItem[], menu: MenuItem[]) {
  return cart.reduce((sum, c) => {
    const item = menu.find((m) => m.id === c.itemId);
    return sum + (item ? item.price * c.qty : 0);
  }, 0);
}
