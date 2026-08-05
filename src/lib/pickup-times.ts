import { currentSettings } from "@/lib/settings";

// Pickup time slot generator (15-minute intervals) for CGCC Cafeteria.
// Operating hours: 8:00 AM – 4:00 PM daily.
export const PICKUP_OPENING_HOUR = 8; // 8:00 AM
export const PICKUP_CLOSING_HOUR = 16; // 4:00 PM
export const PICKUP_INTERVAL_MINUTES = 15;
// Customers need a small buffer so vendors can prepare the order.
export const PICKUP_MIN_LEAD_MINUTES = 15;

export type PickupSlot = { value: string; label: string; minutes: number };

function fmt(hour24: number, minute: number): string {
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const h12 = ((hour24 + 11) % 12) + 1;
  const mm = String(minute).padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}

/**
 * Build all pickup slots for today.
 * Past slots (and slots inside the prep-time buffer) are filtered out.
 * When the cafeteria is already closed for the day, returns tomorrow's slots.
 */
export function buildPickupSlots(now: Date = new Date()): PickupSlot[] {
  // Admin → System Settings controls hours, interval and how far ahead
  // customers may schedule. Falls back to the constants above.
  const s = currentSettings();
  const openH = Number((s.openingTime || "").split(":")[0] ?? NaN);
  const closeH = Number((s.closingTime || "").split(":")[0] ?? NaN);
  const OPEN = Number.isFinite(openH) ? openH : PICKUP_OPENING_HOUR;
  const CLOSE = Number.isFinite(closeH) ? closeH : PICKUP_CLOSING_HOUR;
  const STEP = s.pickupIntervalMinutes > 0 ? s.pickupIntervalMinutes : PICKUP_INTERVAL_MINUTES;
  const MAX_AHEAD = s.maxPickupMinutes > 0 ? s.maxPickupMinutes : 24 * 60;

  const slots: PickupSlot[] = [];
  for (let h = OPEN; h < CLOSE; h++) {
    for (let m = 0; m < 60; m += STEP) {
      slots.push({ value: fmt(h, m), label: fmt(h, m), minutes: h * 60 + m });
    }
  }
  // Include the closing hour on the dot as the final slot (e.g. 4:00 PM).
  slots.push({ value: fmt(CLOSE, 0), label: fmt(CLOSE, 0), minutes: CLOSE * 60 });

  const nowMinutes = now.getHours() * 60 + now.getMinutes() + PICKUP_MIN_LEAD_MINUTES;
  const future = slots.filter(
    (slot) => slot.minutes >= nowMinutes && slot.minutes <= nowMinutes + MAX_AHEAD,
  );
  return future.length > 0 ? future : slots; // fall back to full list (tomorrow)
}

export function isPickupSlotValid(value: string, now: Date = new Date()): boolean {
  return buildPickupSlots(now).some((s) => s.value === value);
}
