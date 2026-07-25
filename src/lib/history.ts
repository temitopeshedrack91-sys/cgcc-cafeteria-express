// Persistent list of the customer's own order codes (this browser).
// Full order data always comes from Supabase — this only remembers which
// codes belong to this device so we can rebuild an Order History view.
const KEY = "cgcc-cafeteria-history-v1";
const MAX = 100;

type Entry = { code: string; at: number };

const isBrowser = typeof window !== "undefined";

export function getHistoryCodes(): string[] {
  if (!isBrowser) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Entry[];
    return list.sort((a, b) => b.at - a.at).map((e) => e.code);
  } catch {
    return [];
  }
}

export function rememberOrder(code: string) {
  if (!isBrowser || !code) return;
  try {
    const raw = localStorage.getItem(KEY);
    const list: Entry[] = raw ? (JSON.parse(raw) as Entry[]) : [];
    const filtered = list.filter((e) => e.code !== code);
    filtered.unshift({ code, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)));
  } catch {}
}
