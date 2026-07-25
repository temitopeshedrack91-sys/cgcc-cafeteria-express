import { useSyncExternalStore } from "react";
import { DEFAULT_MENU, type MenuItem } from "./menu-data";
import { supabase } from "@/integrations/supabase/client";
import { rememberOrder } from "./history";

// ============ Types ============
export type CartItem = { itemId: string; qty: number };

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "collected";

export type OrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  vendorType?: string | null;
  preparationStatus?: string;
};

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type Order = {
  code: string;
  receiptNo: string;
  customerName: string;
  phone: string;
  note?: string;
  orderType: "dine-in" | "takeaway";
  pickupTime?: string;
  items: OrderItem[];
  total: number;
  paymentStatus: PaymentStatus;
  paymentProvider?: string | null;
  paymentReference?: string | null;
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

type LocalSlice = { cart: CartItem[] };

function loadLocal(): LocalSlice {
  const base: LocalSlice = { cart: [] };
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
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ cart: state.cart }));
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
  adminLoggedIn: false,
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
  pickup_time?: string | null;
  total: number;
  payment_status: PaymentStatus;
  payment_provider?: string | null;
  payment_reference?: string | null;
  pickup_status: OrderStatus;
  created_at: string;
  order_items?: {
    menu_item_id: string | null;
    name: string;
    price: number;
    qty: number;
    vendor_type?: string | null;
    preparation_status?: string | null;
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
    pickupTime: row.pickup_time ?? undefined,
    items: (row.order_items ?? []).map((i) => ({
      id: i.menu_item_id ?? i.name,
      name: i.name,
      price: i.price,
      qty: i.qty,
      vendorType: i.vendor_type ?? null,
      preparationStatus: i.preparation_status ?? undefined,
    })),
    total: row.total,
    paymentStatus: row.payment_status,
    paymentProvider: row.payment_provider ?? null,
    paymentReference: row.payment_reference ?? null,
    pickupStatus: row.pickup_status,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function fetchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, code, receipt_no, customer_name, phone, note, order_type, pickup_time, total, payment_status, payment_provider, payment_reference, pickup_status, created_at, order_items ( menu_item_id, name, price, qty, vendor_type, preparation_status )",
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
      "id, code, receipt_no, customer_name, phone, note, order_type, pickup_time, total, payment_status, payment_provider, payment_reference, pickup_status, created_at, order_items ( menu_item_id, name, price, qty, vendor_type, preparation_status )",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return;
  const mapped = mapOrder(data as OrderRow);
  const others = state.orders.filter((o) => o.code !== mapped.code);
  set({ orders: [mapped, ...others] });
}

export async function fetchOrderByCode(
  code: string,
  opts: { timeoutMs?: number } = {},
): Promise<Order | null> {
  const timeoutMs = opts.timeoutMs ?? 12000;
  const rpc = supabase.rpc("get_order_by_code", { _code: code });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), timeoutMs),
  );
  const { data, error } = (await Promise.race([rpc, timeout])) as Awaited<
    typeof rpc
  >;
  if (error) {
    console.error("[store] fetchOrderByCode error", error);
    throw error;
  }
  if (!data) return null;
  const row = data as unknown as OrderRow;
  const mapped = mapOrder(row);
  const others = state.orders.filter((o) => o.code !== mapped.code);
  set({ orders: [mapped, ...others] });
  return mapped;
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

async function checkAdmin(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) {
    set({ adminLoggedIn: false });
    return false;
  }
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  const isAdmin = !error && data === true;
  set({ adminLoggedIn: isAdmin });
  return isAdmin;
}

let inited = false;
function init() {
  if (inited || !isBrowser) return;
  inited = true;

  void checkAdmin().then((isAdmin) => {
    const tasks: Promise<void>[] = [fetchMenu(), fetchSettings()];
    if (isAdmin) tasks.push(fetchOrders());
    void Promise.all(tasks).then(() => set({ loaded: true }));
  });

  supabase.auth.onAuthStateChange(async (event) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    const isAdmin = await checkAdmin();
    if (isAdmin) void fetchOrders();
    else set({ orders: [] });
  });

  supabase
    .channel("cgcc-orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => {
        if (!state.adminLoggedIn) return;
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
        if (!state.adminLoggedIn) return;
        const orderId =
          (payload.new as { order_id?: string }).order_id ??
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

if (isBrowser) init();

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
    set({ menuState: { ...state.menuState, [itemId]: { available: next } } });
    const { error } = await supabase
      .from("menu_items")
      .update({ available: next })
      .eq("id", itemId);
    if (error) {
      console.error("[store] toggleAvailable failed", error);
      set({ menuState: { ...state.menuState, [itemId]: { available: cur } } });
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
    pickupTime: string;
    items: { id: string; name: string; price: number; qty: number }[];
    total: number;
  }): Promise<Order> {
    // Fire-and-forget customer record; RLS hides response but insert succeeds.
    void supabase
      .from("customers")
      .insert({ name: input.customerName, phone: input.phone })
      .then(({ error }) => {
        if (error) console.warn("[store] customer insert skipped", error);
      });

    const { data, error } = await supabase.rpc("create_customer_order", {
      _customer_name: input.customerName,
      _phone: input.phone,
      _note: input.note ?? "",
      _order_type: input.orderType,
      _pickup_time: input.pickupTime,
      // Server ignores price/name — only id + qty are trusted.
      _items: input.items.map((i) => ({ id: i.id, qty: i.qty })),
    });
    if (error) {
      console.error("[store] createOrder rpc failed", error);
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error("Failed to create order");
    }

    const order: Order = {
      code: row.code,
      receiptNo: row.receipt_no,
      customerName: input.customerName,
      phone: input.phone,
      note: input.note,
      orderType: input.orderType,
      pickupTime: row.pickup_time ?? input.pickupTime,
      items: input.items,
      total: row.total,
      paymentStatus: "unpaid",
      pickupStatus: "pending",
      createdAt: new Date(row.created_at).getTime(),
    };
    set({ orders: [order, ...state.orders.filter((o) => o.code !== order.code)] });
    rememberOrder(order.code);
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

  async adminLogin(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? "Sign in failed" };
    }
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (roleErr || isAdmin !== true) {
      await supabase.auth.signOut();
      return { ok: false, error: "This account is not an administrator." };
    }
    set({ adminLoggedIn: true });
    void fetchOrders();
    return { ok: true };
  },

  async adminLogout() {
    await supabase.auth.signOut();
    set({ adminLoggedIn: false, orders: [] });
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
