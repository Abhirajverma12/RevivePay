const { FailureReason } = require('@prisma/client');

/**
 * Weighted selection favoring recoverable / temporary errors:
 * - NETWORK_ERROR: 40%
 * - INSUFFICIENT_FUNDS: 35%
 * - BANK_ERROR: 15%
 * - AUTHENTICATION_FAILED: 5%
 * - CARD_DECLINED: 3%
 * - EXPIRED_CARD: 2%
 */
function getRandomRecoverableFailureReason() {
  const rand = Math.random();
  if (rand < 0.40) return FailureReason.NETWORK_ERROR;
  if (rand < 0.75) return FailureReason.INSUFFICIENT_FUNDS;
  if (rand < 0.90) return FailureReason.BANK_ERROR;
  if (rand < 0.95) return FailureReason.AUTHENTICATION_FAILED;
  if (rand < 0.98) return FailureReason.CARD_DECLINED;
  return FailureReason.EXPIRED_CARD;
}

/**
 * Creates a simulated failed payment on demand
 */
async function simulateFailedPayment(prisma, params) {
  const { customerId, amount, method = 'card' } = params;

  // 1. Verify customer exists
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { merchant: true },
  });

  if (!customer) {
    throw new Error(`Customer with ID "${customerId}" not found`);
  }

  const failureReason = getRandomRecoverableFailureReason();
  const now = new Date();

  // 2. Create Payment with status FAILED
  const payment = await prisma.payment.create({
    data: {
      customer_id: customer.id,
      merchant_id: customer.merchant_id,
      amount: parseFloat(Number(amount).toFixed(2)),
      currency: 'INR',
      status: 'FAILED',
      method,
      created_at: now,
      updated_at: now,
    },
  });

  // 3. Create initial PaymentAttempt
  await prisma.paymentAttempt.create({
    data: {
      payment_id: payment.id,
      attempt_number: 1,
      status: 'FAILED',
      error_message: `Simulator simulated failure: ${failureReason}`,
      attempted_at: now,
    },
  });

  // 4. Create linked FailedPayment
  const failedPayment = await prisma.failedPayment.create({
    data: {
      payment_id: payment.id,
      failure_reason: failureReason,
      retry_count: 0,
      status: 'UNRESOLVED',
      failed_at: now,
    },
  });

  // 5. Update Customer stats
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      failed_payments: { increment: 1 },
    },
  });

  return {
    paymentId: payment.id,
    failedPaymentId: failedPayment.id,
    customerId: customer.id,
    customerName: customer.name,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    failureReason: failedPayment.failure_reason,
    status: failedPayment.status,
    failedAt: failedPayment.failed_at,
  };
}

/**
 * Resolves an intervention as recovered or not, weighted by its recovery_probability
 */
async function simulateRecoveryResult(prisma, interventionId) {
  const intervention = await prisma.intervention.findUnique({
    where: { id: interventionId },
    include: {
      agent_action: {
        include: {
          failed_payment: {
            include: {
              payment: true,
              recovery_prediction: true,
            },
          },
        },
      },
    },
  });

  if (!intervention) {
    throw new Error(`Intervention with ID "${interventionId}" not found`);
  }

  const failedPayment = intervention.agent_action.failed_payment;
  const payment = failedPayment.payment;
  const prediction = failedPayment.recovery_prediction;

  const probability = prediction?.recovery_probability ?? 0.50;
  const isRecovered = Math.random() < probability;
  const amountRecovered = isRecovered ? payment.amount : 0.0;
  const now = new Date();

  const notes = isRecovered
    ? `Recovery successful via simulated execution (probability was ${(probability * 100).toFixed(1)}%).`
    : `Recovery attempt unsuccessful in simulation (probability was ${(probability * 100).toFixed(1)}%).`;

  // Create or update RecoveryOutcome
  await prisma.recoveryOutcome.upsert({
    where: { intervention_id: intervention.id },
    create: {
      intervention_id: intervention.id,
      recovered: isRecovered,
      amount_recovered: amountRecovered,
      resolved_at: now,
      notes,
    },
    update: {
      recovered: isRecovered,
      amount_recovered: amountRecovered,
      resolved_at: now,
      notes,
    },
  });

  // Update Intervention status
  await prisma.intervention.update({
    where: { id: intervention.id },
    data: {
      status: 'COMPLETED',
      details: {
        ...(typeof intervention.details === 'object' && intervention.details ? intervention.details : {}),
        resolvedAt: now.toISOString(),
        outcomeRecovered: isRecovered,
      },
    },
  });

  // Update payment and failed payment statuses
  if (isRecovered) {
    await prisma.failedPayment.update({
      where: { id: failedPayment.id },
      data: { status: 'RECOVERED' },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'RECOVERED' },
    });

    // Update customer stats
    const customer = await prisma.customer.findUnique({
      where: { id: payment.customer_id },
    });

    if (customer) {
      const newSuccessful = customer.successful_payments + 1;
      const totalAttempts = newSuccessful + customer.failed_payments;
      const newRecoveryRate = totalAttempts > 0 ? parseFloat((newSuccessful / totalAttempts).toFixed(2)) : customer.historical_recovery_rate;

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          successful_payments: newSuccessful,
          historical_recovery_rate: newRecoveryRate,
        },
      });
    }
  } else {
    // Increment retry count
    await prisma.failedPayment.update({
      where: { id: failedPayment.id },
      data: {
        retry_count: { increment: 1 },
      },
    });
  }

  return {
    interventionId: intervention.id,
    recovered: isRecovered,
    amountRecovered,
    resolvedAt: now,
    recoveryProbability: probability,
    notes,
  };
}

module.exports = {
  getRandomRecoverableFailureReason,
  simulateFailedPayment,
  simulateRecoveryResult,
};
