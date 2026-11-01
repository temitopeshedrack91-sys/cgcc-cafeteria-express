import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { gatewayDriver } from './provider';
import { EMPTY_PAYMENT_CONFIG } from './types';

describe('unverified payment signatures', () => {
  it('rejects an unsigned test-mode callback', () => {
    assert.equal(gatewayDriver.verifyWebhookSignature({ ...EMPTY_PAYMENT_CONFIG, mode: 'test' }, '{}', ''), false);
  });
  it('rejects an unsigned live-mode callback', () => {
    assert.equal(gatewayDriver.verifyWebhookSignature({ ...EMPTY_PAYMENT_CONFIG, mode: 'live' }, '{}', ''), false);
  });
});