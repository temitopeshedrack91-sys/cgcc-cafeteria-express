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
  const slots: PickupSlot[] = [];
  for (let h = PICKUP_OPENING_HOUR; h < PICKUP_CLOSING_HOUR; h++) {
    for (let m = 0; m < 60; m += PICKUP_INTERVAL_MINUTES) {
      slots.push({ value: fmt(h, m), label: fmt(h, m), minutes: h * 60 + m });
    }
  }
  // Include the closing hour on the dot as the final slot (e.g. 4:00 PM).
  slots.push({
    value: fmt(PICKUP_CLOSING_HOUR, 0),
    label: fmt(PICKUP_CLOSING_HOUR, 0),
    minutes: PICKUP_CLOSING_HOUR * 60,
  });

  const nowMinutes = now.getHours() * 60 + now.getMinutes() + PICKUP_MIN_LEAD_MINUTES;
  const future = slots.filter((s) => s.minutes >= nowMinutes);
  return future.length > 0 ? future : slots; // fall back to full list (tomorrow)
}

export function isPickupSlotValid(value: string, now: Date = new Date()): boolean {
  return buildPickupSlots(now).some((s) => s.value === value);
}
