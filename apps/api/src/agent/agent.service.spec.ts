const assert = require('node:assert');
import { describe, it } from 'node:test';
import { decideRecoveryAction, AgentContext } from '@revivepay/agent';
import { FailureReason, RecoveryStrategy } from '@prisma/client';

describe('AI Recovery Agent Decision Scenarios', () => {
  it('Scenario 1: High-LTV, High-Probability temporary error (NETWORK_ERROR, 0 retries)', async () => {
    const context: AgentContext = {
      customerName: 'Aarav Mehta',
      paymentAmount: 4999,
      failureReason: FailureReason.NETWORK_ERROR,
      customerLTV: 175000,
      successfulPayments: 32,
      failedPayments: 2,
      retryCount: 0,
      recoveryProbability: 0.92,
      allowedActions: [RecoveryStrategy.IMMEDIATE_RETRY, RecoveryStrategy.DELAYED_RETRY],
      requiresHumanApproval: false,
    };

    const result = await decideRecoveryAction(context);
    console.log('\n--- Scenario 1 Decision ---');
    console.log('Action:', result.decision.action);
    console.log('Reason:', result.decision.reason);

    assert.strictEqual(result.decision.action, RecoveryStrategy.IMMEDIATE_RETRY);
    assert.ok(context.allowedActions.includes(result.decision.action as any));
    assert.ok(result.decision.reason.includes('Aarav Mehta'));
    assert.ok(result.decision.reason.includes('NETWORK_ERROR'));
  });

  it('Scenario 2: Mid-Probability customer error (INSUFFICIENT_FUNDS, 1 retry)', async () => {
    const context: AgentContext = {
      customerName: 'Priya Verma',
      paymentAmount: 3200,
      failureReason: FailureReason.INSUFFICIENT_FUNDS,
      customerLTV: 45000,
      successfulPayments: 14,
      failedPayments: 4,
      retryCount: 1,
      recoveryProbability: 0.65,
      allowedActions: [
        RecoveryStrategy.DELAYED_RETRY,
        RecoveryStrategy.REMINDER,
        RecoveryStrategy.PAYMENT_LINK,
        RecoveryStrategy.ALTERNATIVE_METHOD,
      ],
      requiresHumanApproval: false,
    };

    const result = await decideRecoveryAction(context);
    console.log('\n--- Scenario 2 Decision ---');
    console.log('Action:', result.decision.action);
    console.log('Delay Hours:', result.decision.delayHours);
    console.log('Reason:', result.decision.reason);

    assert.ok(context.allowedActions.includes(result.decision.action as any));
    assert.ok(result.decision.reason.includes('Priya Verma'));
    assert.ok(result.decision.reason.includes('INSUFFICIENT_FUNDS'));
    assert.ok(result.decision.delayHours === 24 || result.decision.action !== RecoveryStrategy.DELAYED_RETRY);
  });

  it('Scenario 3: Low-Probability hard failure (EXPIRED_CARD, 3 retries, sub-30%)', async () => {
    const context: AgentContext = {
      customerName: 'Rohan Sharma',
      paymentAmount: 1800,
      failureReason: FailureReason.EXPIRED_CARD,
      customerLTV: 4200,
      successfulPayments: 1,
      failedPayments: 6,
      retryCount: 3,
      recoveryProbability: 0.12,
      allowedActions: [RecoveryStrategy.NO_ACTION],
      requiresHumanApproval: false,
    };

    const result = await decideRecoveryAction(context);
    console.log('\n--- Scenario 3 Decision ---');
    console.log('Action:', result.decision.action);
    console.log('Reason:', result.decision.reason);

    assert.strictEqual(result.decision.action, RecoveryStrategy.NO_ACTION);
    assert.ok(result.decision.reason.includes('Rohan Sharma'));
    assert.ok(result.decision.reason.includes('EXPIRED_CARD'));
    assert.strictEqual(result.decision.expectedRecovery, 0);
  });
});
