import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { CUSTOMER_CATEGORIES, customerCategory } from './customer-categories';

describe('customer category grouping', () => {
  it('keeps the five requested customer categories', () => {
    assert.deepEqual(CUSTOMER_CATEGORIES, ['Food', 'Snacks', 'Coffee & Tea', 'Drinks', 'Sweets']);
  });
  it('groups existing products without losing future categories', () => {
    assert.equal(customerCategory('Meals'), 'Food');
    assert.equal(customerCategory('Sandwiches'), 'Snacks');
    assert.equal(customerCategory('Desserts & Yogurt'), 'Sweets');
    assert.equal(customerCategory('Water'), 'Drinks');
    assert.equal(customerCategory('New category'), 'New category');
  });
});