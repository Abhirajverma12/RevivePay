const assert = require('node:assert');
import { describe, it } from 'node:test';
import { RecoveryPredictionService } from './recovery-prediction.service';
import { FailureReason } from '@prisma/client';

describe('RecoveryPredictionService (Deterministic Scorer)', () => {
  // Pass dummy null PrismaService since calculateScore is a pure function
  const service = new RecoveryPredictionService(null as any);

  it('Scenario 1: High LTV, 0 retries, NETWORK_ERROR should score > 0.70', () => {
    const result = service.calculateScore({
      historicalRecoveryRate: 0.85,
      customerLtv: 150000,
      maxMerchantLtv: 160000, // ~93.7% normalized LTV
      failureReason: FailureReason.NETWORK_ERROR, // temporariness = 0.9
      retryCount: 0,
      maxRetries: 3, // retry allowance = 1.0
      successfulPayments: 30,
      failedPayments: 2, // ~93.7% success ratio
      paymentAmount: 5000,
    });

    console.log('Test 1 (High LTV + Network Error) Score:', result.recoveryProbability);
    assert.ok(
      result.recoveryProbability > 0.70,
      `Expected score > 0.70, got ${result.recoveryProbability}`,
    );
    assert.strictEqual(result.expectedRecovery, parseFloat((5000 * result.recoveryProbability).toFixed(2)));
  });

  it('Scenario 2: Low LTV, max retries reached, EXPIRED_CARD should score < 0.30', () => {
    const result = service.calculateScore({
      historicalRecoveryRate: 0.15,
      customerLtv: 3000,
      maxMerchantLtv: 150000, // ~2% normalized LTV
      failureReason: FailureReason.EXPIRED_CARD, // temporariness = 0.1
      retryCount: 3,
      maxRetries: 3, // retry allowance = 0
      successfulPayments: 1,
      failedPayments: 5, // ~16.6% success ratio
      paymentAmount: 2000,
    });

    console.log('Test 2 (Low LTV + Expired Card) Score:', result.recoveryProbability);
    assert.ok(
      result.recoveryProbability < 0.30,
      `Expected score < 0.30, got ${result.recoveryProbability}`,
    );
    assert.strictEqual(result.expectedRecovery, parseFloat((2000 * result.recoveryProbability).toFixed(2)));
  });

  it('Scenario 3: Mid-tier customer with INSUFFICIENT_FUNDS should score in 0.50 - 0.75 range', () => {
    const result = service.calculateScore({
      historicalRecoveryRate: 0.55,
      customerLtv: 40000,
      maxMerchantLtv: 100000, // 40% normalized LTV
      failureReason: FailureReason.INSUFFICIENT_FUNDS, // temporariness = 0.7
      retryCount: 1,
      maxRetries: 3, // retry allowance = 0.67
      successfulPayments: 12,
      failedPayments: 4, // 75% success ratio
      paymentAmount: 3500,
    });

    console.log('Test 3 (Mid-tier + Insufficient Funds) Score:', result.recoveryProbability);
    assert.ok(
      result.recoveryProbability >= 0.50 && result.recoveryProbability <= 0.75,
      `Expected score between 0.50 and 0.75, got ${result.recoveryProbability}`,
    );
  });

  it('Scenario 4: Score must always clamp to [0, 1] and breakdown factors must sum to score', () => {
    const zeroResult = service.calculateScore({
      historicalRecoveryRate: 0,
      customerLtv: 0,
      maxMerchantLtv: 100000,
      failureReason: FailureReason.EXPIRED_CARD,
      retryCount: 5,
      maxRetries: 3,
      successfulPayments: 0,
      failedPayments: 10,
      paymentAmount: 1000,
    });

    assert.ok(zeroResult.recoveryProbability >= 0 && zeroResult.recoveryProbability <= 1);

    // Sum factor contributions
    const factorSum =
      zeroResult.factors.customer_historical_recovery_rate.contribution +
      zeroResult.factors.normalized_customer_ltv.contribution +
      zeroResult.factors.failure_reason_temporariness.contribution +
      zeroResult.factors.retry_allowance.contribution +
      zeroResult.factors.payment_success_ratio.contribution;

    assert.ok(
      Math.abs(factorSum - zeroResult.recoveryProbability) < 0.001,
      `Factor contributions (${factorSum}) should match score (${zeroResult.recoveryProbability})`,
    );
  });
});
