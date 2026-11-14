import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  DEFAULT_CUSTOMER_CATEGORIES,
  customerCategory,
  formatVendorSectionLabel,
  slugifyVendorKey,
  vendorKeyForCategoryName,
} from './customer-categories';

describe('customer categories and vendor section helpers', () => {
  it('provides the default categories and preserves 1:1 category names', () => {
    assert.deepEqual(DEFAULT_CUSTOMER_CATEGORIES, ['Food', 'Snacks', 'Coffee & Tea', 'Drinks', 'Sweets']);
    assert.equal(customerCategory('Food'), 'Food');
    assert.equal(customerCategory('  Sweets  '), 'Sweets');
    assert.equal(customerCategory('Grill & Shawarma'), 'Grill & Shawarma');
    assert.equal(customerCategory('Desserts & Yogurt'), 'Desserts & Yogurt');
  });

  it('normalizes vendor section keys and formats custom labels cleanly', () => {
    assert.equal(slugifyVendorKey("Queen's Ward!"), 'queens_ward');
    assert.equal(vendorKeyForCategoryName('Coffee & Tea'), 'coffee');
    assert.equal(vendorKeyForCategoryName('Sweets'), 'sweets');
    assert.equal(vendorKeyForCategoryName('Grill & Shawarma'), 'grill_shawarma');

    assert.equal(
      formatVendorSectionLabel('sweets', {
        categories: [{ id: 'c1', name: 'Sweets' }],
      }),
      'Sweets',
    );
    assert.equal(
      formatVendorSectionLabel('queens_ward', {
        vendors: [{ vendor_type: 'queens_ward', display_label: "Queen's Ward Snacks", active: true }],
      }),
      "Queen's Ward Snacks",
    );
    assert.equal(formatVendorSectionLabel('fresh_grill'), 'Fresh Grill');
  });
});