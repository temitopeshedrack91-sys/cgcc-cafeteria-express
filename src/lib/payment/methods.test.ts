import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { choosePaymentMethod } from './methods';
describe('enabled payment choices', () => {
  it('respects either preferred method while both remain enabled', () => {
    assert.equal(choosePaymentMethod(true,true,'transfer'),'transfer');
    assert.equal(choosePaymentMethod(true,true,'online'),'online');
  });
  it('falls back to the other enabled method', () => {
    assert.equal(choosePaymentMethod(false,true,'online'),'transfer');
    assert.equal(choosePaymentMethod(true,false,'transfer'),'online');
  });
  it('does not select a disabled method', () => {
    assert.equal(choosePaymentMethod(false,false),null);
  });
});