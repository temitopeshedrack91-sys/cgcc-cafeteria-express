import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canChangeStock } from './vendor-permissions';
const expect = (value: boolean) => ({ toBe: (expected: boolean) => assert.equal(value, expected) });

describe('individual vendor stock permissions', () => {
  const previous = { online: 10, walkin: 5 };
  test('increasing stock needs increase permission', () => {
    expect(canChangeStock(previous, { online: 11, walkin: 5 }, { increase: false, reduce: true, reallocate: true })).toBe(false);
    expect(canChangeStock(previous, { online: 11, walkin: 5 }, { increase: true, reduce: false, reallocate: false })).toBe(true);
  });
  test('reducing stock needs reduce permission', () => {
    expect(canChangeStock(previous, { online: 9, walkin: 5 }, { increase: true, reduce: false, reallocate: true })).toBe(false);
    expect(canChangeStock(previous, { online: 9, walkin: 5 }, { increase: false, reduce: true, reallocate: false })).toBe(true);
  });
  test('moving stock needs reallocation permission and preserves the total', () => {
    expect(canChangeStock(previous, { online: 12, walkin: 3 }, { increase: true, reduce: true, reallocate: false })).toBe(false);
    expect(canChangeStock(previous, { online: 12, walkin: 3 }, { increase: false, reduce: false, reallocate: true })).toBe(true);
  });
  test('negative or fractional stock is rejected', () => {
    expect(canChangeStock(previous, { online: -1, walkin: 5 }, { increase: true, reduce: true, reallocate: true })).toBe(false);
    expect(canChangeStock(previous, { online: 1.5, walkin: 5 }, { increase: true, reduce: true, reallocate: true })).toBe(false);
  });
});