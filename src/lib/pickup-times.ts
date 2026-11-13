import { currentSettings } from "@/lib/settings";

// Pickup time slot generator for CGCC Cafeteria.
// Default operating hours: 8:00 AM – 4:00 PM daily.
export const PICKUP_OPENING_HOUR = 8; // 8:00 AM
export const PICKUP_CLOSING_HOUR = 16; // 4:00 PM
export const PICKUP_INTERVAL_MINUTES = 15;
// Scheduled slots require a small lead buffer; immediate pickup uses PICKUP_NOW_VALUE.
export const PICKUP_MIN_LEAD_MINUTES = 15;
export const PICKUP_NOW_VALUE = "Pick up now";

export type PickupSlot = { value: string; label: string; minutes: number };

function fmt(hour24: number, minute: number): string {
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const h12 = ((hour24 + 11) % 12) + 1;
  const mm = String(minute).padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}

function parseTimeMinutes(hhmm: string | undefined, fallbackMinutes: number): number {
  if (!hhmm) return fallbackMinutes;
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? "0");
  if (!Number.isFinite(h) || h < 0 || h > 23) return fallbackMinutes;
  const mins = Number.isFinite(m) && m >= 0 && m < 60 ? m : 0;
  return h * 60 + mins;
}

export function formatClockTime(hhmm: string | undefined, fallbackMinutes: number): string {
  const total = parseTimeMinutes(hhmm, fallbackMinutes);
  return fmt(Math.floor(total / 60), total % 60);
}

/**
 * Build all scheduled pickup slots for today.
 * Past slots (and slots inside the prep-time buffer) are filtered out.
 * When the cafeteria is already closed for the day, returns tomorrow's slots.
 */
export function buildPickupSlots(
  now: Date = new Date(),
  settingsOverride?: Partial<ReturnType<typeof currentSettings>>,
): PickupSlot[] {
  // Admin → System Settings controls hours, interval and how far ahead
  // customers may schedule. Falls back to the constants above.
  const s = { ...currentSettings(), ...settingsOverride };
  const openMinutes = parseTimeMinutes(s.openingTime, PICKUP_OPENING_HOUR * 60);
  const closeMinutes = Math.max(
    openMinutes,
    parseTimeMinutes(s.closingTime, PICKUP_CLOSING_HOUR * 60),
  );
  const STEP =
    s.pickupIntervalMinutes > 0
      ? Math.max(5, Math.floor(s.pickupIntervalMinutes))
      : PICKUP_INTERVAL_MINUTES;
  const MAX_AHEAD = s.maxPickupMinutes > 0 ? s.maxPickupMinutes : 24 * 60;

  const slots: PickupSlot[] = [];
  for (let mins = openMinutes; mins <= closeMinutes; mins += STEP) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const label = fmt(h, m);
    slots.push({ value: label, label, minutes: mins });
  }
  const last = slots[slots.length - 1];
  if (!last || last.minutes < closeMinutes) {
    const label = fmt(Math.floor(closeMinutes / 60), closeMinutes % 60);
    slots.push({ value: label, label, minutes: closeMinutes });
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes() + PICKUP_MIN_LEAD_MINUTES;
  const future = slots.filter(
    (slot) => slot.minutes >= nowMinutes && slot.minutes <= nowMinutes + MAX_AHEAD,
  );
  return future.length > 0 ? future : slots; // fall back to full list (tomorrow)
}

export function isPickupSlotValid(
  value: string,
  now: Date = new Date(),
  settingsOverride?: Partial<ReturnType<typeof currentSettings>>,
): boolean {
  if (value === PICKUP_NOW_VALUE) return true;
  return buildPickupSlots(now, settingsOverride).some((s) => s.value === value);
}
