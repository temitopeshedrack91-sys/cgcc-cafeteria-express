import { supabase } from "@/integrations/supabase/client";

// CGCC operates on Africa/Lagos time. Business days roll over at midnight
// there, and admins can also close a day early.
export const BUSINESS_TZ = "Africa/Lagos";

export type FilterMode = "today" | "yesterday" | "date" | "range" | "all";

export type BusinessDayFilter = {
  mode: FilterMode;
  /** yyyy-mm-dd (used when mode = "date") */
  date?: string;
  /** yyyy-mm-dd (used when mode = "range") */
  from?: string;
  to?: string;
  /** Include archived (closed-day) rows. Default false. */
  includeArchived?: boolean;
};

const dtf = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** yyyy-mm-dd for a Date in Africa/Lagos. */
export function toBusinessDay(d: Date): string {
  return dtf.format(d);
}

export function currentBusinessDay(): string {
  return toBusinessDay(new Date());
}

export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function defaultFilter(): BusinessDayFilter {
  return { mode: "today" };
}

/** Resolves a filter to a business_day range (inclusive) or null = All. */
export function resolveFilter(
  f: BusinessDayFilter,
): { from: string; to: string } | null {
  const today = currentBusinessDay();
  switch (f.mode) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "date": {
      const d = f.date ?? today;
      return { from: d, to: d };
    }
    case "range": {
      const from = f.from ?? today;
      const to = f.to ?? from;
      return from <= to ? { from, to } : { from: to, to: from };
    }
    case "all":
      return null;
  }
}

/**
 * Client-side predicate. Rows must expose `businessDay` (yyyy-mm-dd) and
 * `archivedAt` (nullable ISO string / timestamp).
 */
export function matchesFilter(
  row: { businessDay?: string | null; archivedAt?: string | number | null },
  f: BusinessDayFilter,
): boolean {
  if (!f.includeArchived && f.mode !== "all" && row.archivedAt) return false;
  const r = resolveFilter(f);
  if (!r) return true;
  const bd = row.businessDay;
  if (!bd) return false;
  return bd >= r.from && bd <= r.to;
}

export function labelForFilter(f: BusinessDayFilter): string {
  switch (f.mode) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "date":
      return f.date ?? "Select date";
    case "range":
      return `${f.from ?? "…"} → ${f.to ?? "…"}`;
    case "all":
      return "All history";
  }
}

// ------- RPCs -------

export async function closeBusinessDay(day?: string, note?: string) {
  const args: Record<string, string> = {};
  if (day) args._day = day;
  if (note) args._note = note;
  const { data, error } = await supabase.rpc("close_business_day", args as never);
  if (error) throw error;
  return data as {
    ok: boolean;
    business_day: string;
    orders_archived: number;
    cashier_sales_archived: number;
  };
}

export async function reopenBusinessDay(day: string) {
  const { data, error } = await supabase.rpc("reopen_business_day", { _day: day });
  if (error) throw error;
  return data as { ok: boolean; business_day: string };
}

export type ClosureRow = {
  business_day: string;
  closed_at: string;
  note: string | null;
};

export async function listClosures(limit = 30): Promise<ClosureRow[]> {
  const { data, error } = await supabase
    .from("business_day_closures")
    .select("business_day, closed_at, note")
    .order("business_day", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ClosureRow[];
}
