import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  PICKUP_NOW_VALUE,
  buildPickupSlots,
  formatClockTime,
  isPickupSlotValid,
} from "./pickup-times";

describe("pickup times", () => {
  it("supports 'Pick up now' within DB length limit", () => {
    assert.ok(PICKUP_NOW_VALUE.length <= 20);
    assert.equal(isPickupSlotValid(PICKUP_NOW_VALUE), true);
  });

  it("generates scheduled slots and formats clock times", () => {
    const morning = new Date(2026, 10, 13, 7, 30, 0);
    const slots15 = buildPickupSlots(morning, { pickupIntervalMinutes: 15 });
    assert.ok(slots15.length > 0);
    assert.equal(slots15[0].value, "8:00 AM");
    assert.equal(slots15[1].value, "8:15 AM");
    assert.equal(isPickupSlotValid("8:00 AM", morning), true);

    const slots20 = buildPickupSlots(morning, { pickupIntervalMinutes: 20 });
    assert.equal(slots20[0].value, "8:00 AM");
    assert.equal(slots20[1].value, "8:20 AM");
    assert.equal(slots20[2].value, "8:40 AM");
    assert.equal(slots20[3].value, "9:00 AM");

    assert.equal(formatClockTime("16:30", 960), "4:30 PM");
  });
});
