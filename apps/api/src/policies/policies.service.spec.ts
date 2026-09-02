const assert = require('node:assert');
import { describe, it } from 'node:test';
import { PoliciesService } from './policies.service';
import { FailureReason, RecoveryStrategy } from '@prisma/client';

describe('PoliciesService (Merchant Policies & Guardrails)', () => {
  const service = new PoliciesService(null as any);

  it('Test 1: High-value payment (> threshold) always requires approval even with 0.95 probability', () => {
    const evaluation = service.evaluate(
      {
        failure_reason: FailureReason.NETWORK_ERROR,
        retry_count: 0,
        amount: 75000, // Exceeds 50,000 threshold
      },
      {
        recovery_probability: 0.95,
        expected_recovery: 71250,
      },
      {
        max_retries: 3,
        max_discount_pct: 15,
        high_value_approval_threshold: 50000,
      },
    );

    console.log('High-value eval approval required:', evaluation.requiresHumanApproval);
    assert.strictEqual(evaluation.requiresHumanApproval, true);
    assert.ok(evaluation.reason.includes('requires explicit human sign-off'));
    assert.ok(evaluation.allowedActions.includes(RecoveryStrategy.IMMEDIATE_RETRY));
  });

  it('Test 2: Low-probability payment (< 0.30) returns strictly [NO_ACTION]', () => {
    const evaluation = service.evaluate(
      {
        failure_reason: FailureReason.EXPIRED_CARD,
        retry_count: 2,
        amount: 2500,
      },
      {
        recovery_probability: 0.15,
        expected_recovery: 375,
      },
      {
        max_retries: 3,
        max_discount_pct: 15,
        high_value_approval_threshold: 50000,
      },
    );

    console.log('Low-probability allowed actions:', evaluation.allowedActions);
    assert.deepStrictEqual(evaluation.allowedActions, [RecoveryStrategy.NO_ACTION]);
    assert.strictEqual(evaluation.requiresHumanApproval, false);
  });

  it('Test 3: INCENTIVE is strictly excluded when discount cost exceeds expected recovery benefit', () => {
    // Discount cost: 10,000 * 20% = 2,000
    // Expected recovery: 10,000 * 0.35 = 3,500. Half of expected recovery = 1,750 < 2,000 cost.
    const evaluation = service.evaluate(
      {
        failure_reason: FailureReason.INSUFFICIENT_FUNDS,
        retry_count: 1,
        amount: 10000,
      },
      {
        recovery_probability: 0.35,
        expected_recovery: 3500,
      },
      {
        max_retries: 3,
        max_discount_pct: 20,
        high_value_approval_threshold: 50000,
      },
    );

    assert.ok(!evaluation.allowedActions.includes(RecoveryStrategy.INCENTIVE));
    assert.strictEqual(evaluation.policySummary.discountJustified, false);
  });

  it('Test 4: High-probability temporary failure permits IMMEDIATE_RETRY and DELAYED_RETRY', () => {
    const evaluation = service.evaluate(
      {
        failure_reason: FailureReason.NETWORK_ERROR,
        retry_count: 0,
        amount: 3500,
      },
      {
        recovery_probability: 0.88,
        expected_recovery: 3080,
      },
      {
        max_retries: 3,
        max_discount_pct: 15,
        high_value_approval_threshold: 50000,
      },
    );

    assert.ok(evaluation.allowedActions.includes(RecoveryStrategy.IMMEDIATE_RETRY));
    assert.ok(evaluation.allowedActions.includes(RecoveryStrategy.DELAYED_RETRY));
    assert.strictEqual(evaluation.requiresHumanApproval, false);
  });
});
