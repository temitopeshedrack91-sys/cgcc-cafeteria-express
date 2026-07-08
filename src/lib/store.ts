import { useSyncExternalStore } from "react";
import { DEFAULT_MENU, type MenuItem } from "./menu-data";
import { supabase } from "@/integrations/supabase/client";

// ============ Types ============
export type CartItem = { itemId: string; qty: number };

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "collected";

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
  orderingOpen: boolean;
  adminLoggedIn: boolean;
  loaded: boolean;
};

// ============ Storage (client-only slices) ============
const LOCAL_KEY = "cgcc-cafeteria-local-v2";
const isBrowser = typeof window !== "undefined";

type LocalSlice = { cart: CartItem[]; adminLoggedIn: boolean };

function loadLocal(): LocalSlice {
  const base: LocalSlice = { cart: [], adminLoggedIn: false };
  if (!isBrowser) return base;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return base;
    return { ...base, ...(JSON.parse(raw) as Partial<LocalSlice>) };
  } catch {
    return base;
  }
}

function persistLocal() {
  if (!isBrowser) return;
  try {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({ cart: state.cart, adminLoggedIn: state.adminLoggedIn }),
    );
  } catch {}
}

// ============ State ============
const initialLocal = loadLocal();
let state: AppState = {
  cart: initialLocal.cart,
  menu: DEFAULT_MENU,
  menuState: Object.fromEntries(
    DEFAULT_MENU.map((m) => [m.id, { available: true }]),
  ),
  orders: [],
  orderingOpen: true,
  adminLoggedIn: initialLocal.adminLoggedIn,
  loaded: false,
};

const listeners = new Set<() => void>();

function set(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  persistLocal();
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

// ============ Supabase mapping ============
type OrderRow = {
  id: string;
  code: string;
  receipt_no: string;
  customer_name: string;
  phone: string;
  note: string | null;
  order_type: "dine-in" | "takeaway";
  total: number;
  payment_status: "paid" | "unpaid";
  pickup_status: OrderStatus;
  created_at: string;
  order_items?: {
    menu_item_id: string | null;
    name: string;
    price: number;
    qty: number;
  }[];
};

function mapOrder(row: OrderRow): Order {
  return {
    code: row.code,
    receiptNo: row.receipt_no,
    customerName: row.customer_name,
    phone: row.phone,
    note: row.note ?? undefined,
    orderType: row.order_type,
    items: (row.order_items ?? []).map((i) => ({
      id: i.menu_item_id ?? i.name,
      name: i.name,
      price: i.price,
      qty: i.qty,
    })),
    total: row.total,
    paymentStatus: row.payment_status,
    pickupStatus: row.pickup_status,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function fetchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, code, receipt_no, customer_name, phone, note, order_type, total, payment_status, pickup_status, created_at, order_items ( menu_item_id, name, price, qty )",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[store] fetchOrders failed", error);
    return;
  }
  set({ orders: (data as OrderRow[]).map(mapOrder) });
}

async function fetchOneOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, code, receipt_no, customer_name, phone, note, order_type, total, payment_status, pickup_status, created_at, order_items ( menu_item_id, name, price, qty )",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return;
  const mapped = mapOrder(data as OrderRow);
  const others = state.orders.filter((o) => o.code !== mapped.code);
  set({ orders: [mapped, ...others] });
}

async function fetchMenu() {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, available");
  if (error) {
    console.error("[store] fetchMenu failed", error);
    return;
  }
  const menuState: MenuState = { ...state.menuState };
  for (const row of data as { id: string; available: boolean }[]) {
    menuState[row.id] = { available: row.available };
  }
  set({ menuState });
}

async function fetchSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("ordering_open")
    .eq("id", "global")
    .maybeSingle();
  if (error) {
    console.error("[store] fetchSettings failed", error);
    return;
  }
  if (data) set({ orderingOpen: data.ordering_open });
}

let inited = false;
function init() {
  if (inited || !isBrowser) return;
  inited = true;

  void Promise.all([fetchMenu(), fetchSettings(), fetchOrders()]).then(() =>
    set({ loaded: true }),
  );

  supabase
    .channel("cgcc-orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const code = (payload.old as { code?: string }).code;
          if (code) set({ orders: state.orders.filter((o) => o.code !== code) });
          return;
        }
        const id = (payload.new as { id?: string }).id;
        if (id) void fetchOneOrder(id);
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "order_items" },
      (payload) => {
        const orderId = (payload.new as { order_id?: string }).order_id ??
          (payload.old as { order_id?: string }).order_id;
        if (orderId) void fetchOneOrder(orderId);
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "menu_items" },
      () => void fetchMenu(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_settings" },
      () => void fetchSettings(),
    )
    .subscribe();
}

if (isBrowser) {
  // Kick off initialization once the module loads in the browser.
  init();
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
      set({
        cart: state.cart.map((c) => (c.itemId === itemId ? { ...c, qty } : c)),
      });
    }
  },
  removeFromCart(itemId: string) {
    set({ cart: state.cart.filter((c) => c.itemId !== itemId) });
  },
  clearCart() {
    set({ cart: [] });
  },

  async toggleAvailable(itemId: string) {
    const cur = state.menuState[itemId]?.available ?? true;
    const next = !cur;
    // optimistic
    set({
      menuState: { ...state.menuState, [itemId]: { available: next } },
    });
    const { error } = await supabase
      .from("menu_items")
      .update({ available: next })
      .eq("id", itemId);
    if (error) {
      console.error("[store] toggleAvailable failed", error);
      // revert
      set({
        menuState: { ...state.menuState, [itemId]: { available: cur } },
      });
    }
  },

  async setOrderingOpen(open: boolean) {
    const prev = state.orderingOpen;
    set({ orderingOpen: open });
    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: "global", ordering_open: open, updated_at: new Date().toISOString() });
    if (error) {
      console.error("[store] setOrderingOpen failed", error);
      set({ orderingOpen: prev });
    }
  },

  async createOrder(input: {
    customerName: string;
    phone: string;
    note?: string;
    orderType: "dine-in" | "takeaway";
    items: { id: string; name: string; price: number; qty: number }[];
    total: number;
  }): Promise<Order> {
    // Upsert lightweight customer record (best-effort; ignore failure)
    let customerId: string | null = null;
    try {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", input.phone)
        .maybeSingle();
      if (existing) {
        customerId = existing.id;
        await supabase
          .from("customers")
          .update({ name: input.customerName })
          .eq("id", existing.id);
      } else {
        const { data: created } = await supabase
          .from("customers")
          .insert({ name: input.customerName, phone: input.phone })
          .select("id")
          .maybeSingle();
        customerId = created?.id ?? null;
      }
    } catch (e) {
      console.warn("[store] customer upsert skipped", e);
    }

    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: customerId,
        customer_name: input.customerName,
        phone: input.phone,
        note: input.note && input.note.length > 0 ? input.note : null,
        order_type: input.orderType,
        total: input.total,
      })
      .select("id, code, receipt_no, created_at")
      .single();
    if (orderErr || !orderRow) {
      console.error("[store] createOrder failed", orderErr);
      throw orderErr ?? new Error("Failed to create order");
    }

    const { error: itemsErr } = await supabase.from("order_items").insert(
      input.items.map((i) => ({
        order_id: orderRow.id,
        menu_item_id: i.id,
        name: i.name,
        price: i.price,
        qty: i.qty,
      })),
    );
    if (itemsErr) {
      console.error("[store] createOrder items failed", itemsErr);
      throw itemsErr;
    }

    const order: Order = {
      code: orderRow.code,
      receiptNo: orderRow.receipt_no,
      customerName: input.customerName,
      phone: input.phone,
      note: input.note,
      orderType: input.orderType,
      items: input.items,
      total: input.total,
      paymentStatus: "unpaid",
      pickupStatus: "pending",
      createdAt: new Date(orderRow.created_at).getTime(),
    };
    set({ orders: [order, ...state.orders.filter((o) => o.code !== order.code)] });
    return order;
  },

  async updateOrderStatus(code: string, pickupStatus: OrderStatus) {
    const prev = state.orders;
    set({
      orders: state.orders.map((o) =>
        o.code === code ? { ...o, pickupStatus } : o,
      ),
    });
    const { error } = await supabase
      .from("orders")
      .update({ pickup_status: pickupStatus })
      .eq("code", code);
    if (error) {
      console.error("[store] updateOrderStatus failed", error);
      set({ orders: prev });
    }
  },

  async confirmPayment(code: string) {
    const prev = state.orders;
    set({
      orders: state.orders.map((o) =>
        o.code === code
          ? {
              ...o,
              paymentStatus: "paid",
              pickupStatus:
                o.pickupStatus === "pending" ? "confirmed" : o.pickupStatus,
            }
          : o,
      ),
    });
    const current = prev.find((o) => o.code === code);
    const nextPickup =
      current && current.pickupStatus === "pending"
        ? "confirmed"
        : current?.pickupStatus ?? "confirmed";
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "paid", pickup_status: nextPickup })
      .eq("code", code);
    if (error) {
      console.error("[store] confirmPayment failed", error);
      set({ orders: prev });
    }
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
