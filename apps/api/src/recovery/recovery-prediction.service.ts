import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FailureReason } from '@prisma/client';

export const TEMPORARINESS_LOOKUP: Record<FailureReason, number> = {
  [FailureReason.NETWORK_ERROR]: 0.9,
  [FailureReason.INSUFFICIENT_FUNDS]: 0.7,
  [FailureReason.BANK_ERROR]: 0.6,
  [FailureReason.AUTHENTICATION_FAILED]: 0.4,
  [FailureReason.CARD_DECLINED]: 0.3,
  [FailureReason.EXPIRED_CARD]: 0.1,
};

export interface ScorerInput {
  historicalRecoveryRate: number;
  customerLtv: number;
  maxMerchantLtv: number;
  failureReason: FailureReason;
  retryCount: number;
  maxRetries: number;
  successfulPayments: number;
  failedPayments: number;
  paymentAmount: number;
}

export interface FactorBreakdown {
  weight: number;
  raw: number;
  contribution: number;
}

export interface ScorerResult {
  recoveryProbability: number;
  expectedRecovery: number;
  factors: {
    customer_historical_recovery_rate: FactorBreakdown;
    normalized_customer_ltv: FactorBreakdown;
    failure_reason_temporariness: FactorBreakdown;
    retry_allowance: FactorBreakdown;
    payment_success_ratio: FactorBreakdown;
  };
}

@Injectable()
export class RecoveryPredictionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure deterministic scorer calculation function
   */
  calculateScore(input: ScorerInput): ScorerResult {
    const {
      historicalRecoveryRate,
      customerLtv,
      maxMerchantLtv,
      failureReason,
      retryCount,
      maxRetries,
      successfulPayments,
      failedPayments,
      paymentAmount,
    } = input;

    // 1. Historical Recovery Rate (30% weight)
    const recoveryRateRaw = Math.max(0, Math.min(1, historicalRecoveryRate ?? 0));
    const recoveryRateContrib = 0.30 * recoveryRateRaw;

    // 2. Normalized Customer LTV (20% weight)
    const normalizedLtvRaw = maxMerchantLtv > 0 ? Math.max(0, Math.min(1, customerLtv / maxMerchantLtv)) : 0;
    const ltvContrib = 0.20 * normalizedLtvRaw;

    // 3. Failure Reason Temporariness (20% weight)
    const temporarinessRaw = TEMPORARINESS_LOOKUP[failureReason] ?? 0.5;
    const temporarinessContrib = 0.20 * temporarinessRaw;

    // 4. Retry Allowance: (1 - retry_count / merchant_policy.max_retries) (15% weight)
    const effectiveMaxRetries = maxRetries > 0 ? maxRetries : 3;
    const retryAllowanceRaw = Math.max(0, Math.min(1, 1 - retryCount / effectiveMaxRetries));
    const retryContrib = 0.15 * retryAllowanceRaw;

    // 5. Payment Success Ratio: successful / (successful + failed) (15% weight)
    const totalTransactions = successfulPayments + failedPayments;
    const successRatioRaw = totalTransactions > 0 ? Math.max(0, Math.min(1, successfulPayments / totalTransactions)) : 0.5;
    const successRatioContrib = 0.15 * successRatioRaw;

    // Total score clamped to [0, 1]
    const totalScore = recoveryRateContrib + ltvContrib + temporarinessContrib + retryContrib + successRatioContrib;
    const recoveryProbability = parseFloat(Math.max(0, Math.min(1, totalScore)).toFixed(4));
    const expectedRecovery = parseFloat((paymentAmount * recoveryProbability).toFixed(2));

    return {
      recoveryProbability,
      expectedRecovery,
      factors: {
        customer_historical_recovery_rate: {
          weight: 0.30,
          raw: parseFloat(recoveryRateRaw.toFixed(4)),
          contribution: parseFloat(recoveryRateContrib.toFixed(4)),
        },
        normalized_customer_ltv: {
          weight: 0.20,
          raw: parseFloat(normalizedLtvRaw.toFixed(4)),
          contribution: parseFloat(ltvContrib.toFixed(4)),
        },
        failure_reason_temporariness: {
          weight: 0.20,
          raw: parseFloat(temporarinessRaw.toFixed(4)),
          contribution: parseFloat(temporarinessContrib.toFixed(4)),
        },
        retry_allowance: {
          weight: 0.15,
          raw: parseFloat(retryAllowanceRaw.toFixed(4)),
          contribution: parseFloat(retryContrib.toFixed(4)),
        },
        payment_success_ratio: {
          weight: 0.15,
          raw: parseFloat(successRatioRaw.toFixed(4)),
          contribution: parseFloat(successRatioContrib.toFixed(4)),
        },
      },
    };
  }

  /**
   * Evaluates and records a prediction for a failed payment in the database
   */
  async analyzePayment(paymentIdOrFailedPaymentId: string) {
    // 1. Locate the failed payment
    const failedPayment = await this.prisma.failedPayment.findFirst({
      where: {
        OR: [
          { id: paymentIdOrFailedPaymentId },
          { payment_id: paymentIdOrFailedPaymentId },
        ],
      },
      include: {
        payment: {
          include: {
            customer: true,
            merchant: {
              include: {
                policy: true,
              },
            },
          },
        },
      },
    });

    if (!failedPayment) {
      throw new NotFoundException(`Failed payment not found for identifier "${paymentIdOrFailedPaymentId}"`);
    }

    const customer = failedPayment.payment.customer;
    const merchant = failedPayment.payment.merchant;
    const policy = merchant.policy;

    // 2. Fetch maximum LTV for this merchant to normalize
    const maxLtvAgg = await this.prisma.customer.aggregate({
      where: { merchant_id: merchant.id },
      _max: { lifetime_value: true },
    });
    const maxMerchantLtv = maxLtvAgg._max.lifetime_value || 100000;

    // 3. Compute score
    const scorerResult = this.calculateScore({
      historicalRecoveryRate: customer.historical_recovery_rate,
      customerLtv: customer.lifetime_value,
      maxMerchantLtv,
      failureReason: failedPayment.failure_reason,
      retryCount: failedPayment.retry_count,
      maxRetries: policy?.max_retries ?? 3,
      successfulPayments: customer.successful_payments,
      failedPayments: customer.failed_payments,
      paymentAmount: failedPayment.payment.amount,
    });

    // 4. Upsert RecoveryPrediction
    const prediction = await this.prisma.recoveryPrediction.upsert({
      where: { failed_payment_id: failedPayment.id },
      create: {
        failed_payment_id: failedPayment.id,
        recovery_probability: scorerResult.recoveryProbability,
        expected_recovery: scorerResult.expectedRecovery,
        model_version: 'rule-based-v1',
        factor_scores: scorerResult.factors as any,
        predicted_at: new Date(),
      },
      update: {
        recovery_probability: scorerResult.recoveryProbability,
        expected_recovery: scorerResult.expectedRecovery,
        model_version: 'rule-based-v1',
        factor_scores: scorerResult.factors as any,
        predicted_at: new Date(),
      },
    });

    return {
      prediction,
      failedPayment: {
        id: failedPayment.id,
        paymentId: failedPayment.payment_id,
        failureReason: failedPayment.failure_reason,
        retryCount: failedPayment.retry_count,
        status: failedPayment.status,
        failedAt: failedPayment.failed_at,
        amount: failedPayment.payment.amount,
        currency: failedPayment.payment.currency,
        method: failedPayment.payment.method,
      },
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        lifetimeValue: customer.lifetime_value,
        historicalRecoveryRate: customer.historical_recovery_rate,
      },
      merchant: {
        id: merchant.id,
        name: merchant.name,
        maxRetries: policy?.max_retries ?? 3,
      },
    };
  }

  /**
   * Retrieves full details for a payment including prediction and context
   */
  async getPaymentDetails(paymentIdOrFailedPaymentId: string) {
    const failedPayment = await this.prisma.failedPayment.findFirst({
      where: {
        OR: [
          { id: paymentIdOrFailedPaymentId },
          { payment_id: paymentIdOrFailedPaymentId },
        ],
      },
      include: {
        payment: {
          include: {
            customer: true,
            merchant: {
              include: {
                policy: true,
              },
            },
            payment_attempts: {
              orderBy: { attempt_number: 'desc' },
            },
          },
        },
        recovery_prediction: true,
        agent_actions: {
          include: {
            interventions: {
              include: {
                recovery_outcome: true,
              },
            },
          },
          orderBy: { decided_at: 'desc' },
        },
      },
    });

    if (!failedPayment) {
      throw new NotFoundException(`Payment not found for identifier "${paymentIdOrFailedPaymentId}"`);
    }

    return {
      payment: failedPayment.payment,
      failedPayment: {
        id: failedPayment.id,
        payment_id: failedPayment.payment_id,
        failure_reason: failedPayment.failure_reason,
        retry_count: failedPayment.retry_count,
        status: failedPayment.status,
        failed_at: failedPayment.failed_at,
      },
      prediction: failedPayment.recovery_prediction,
      customer: failedPayment.payment.customer,
      merchant: failedPayment.payment.merchant,
      policy: failedPayment.payment.merchant.policy,
      attempts: failedPayment.payment.payment_attempts,
      actions: failedPayment.agent_actions,
    };
  }

  /**
   * Paginated and filtered table query for failed payments
   */
  async getFailedPayments(params: {
    page?: number;
    limit?: number;
    merchantId?: string;
    failureReason?: FailureReason;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const page = Math.max(1, params.page ? Number(params.page) : 1);
    const limit = Math.max(1, Math.min(100, params.limit ? Number(params.limit) : 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.merchantId) {
      where.payment = { ...where.payment, merchant_id: params.merchantId };
    }

    if (params.failureReason) {
      where.failure_reason = params.failureReason;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.startDate || params.endDate) {
      where.failed_at = {};
      if (params.startDate) where.failed_at.gte = new Date(params.startDate);
      if (params.endDate) where.failed_at.lte = new Date(params.endDate);
    }

    if (params.search) {
      where.payment = {
        ...where.payment,
        customer: {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { email: { contains: params.search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.failedPayment.count({ where }),
      this.prisma.failedPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { failed_at: 'desc' },
        include: {
          payment: {
            include: { customer: true },
          },
          recovery_prediction: true,
          agent_actions: {
            take: 1,
            orderBy: { decided_at: 'desc' },
          },
        },
      }),
    ]);

    const data = items.map((item) => {
      const prediction = item.recovery_prediction;
      const latestAction = item.agent_actions[0];
      const customer = item.payment.customer;

      return {
        paymentId: item.payment.id,
        failedPaymentId: item.id,
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        amount: item.payment.amount,
        currency: item.payment.currency,
        method: item.payment.method,
        failure_reason: item.failure_reason,
        retry_count: item.retry_count,
        recovery_probability: prediction?.recovery_probability ?? null,
        recommended_action: latestAction?.action ?? null,
        expected_recovery: prediction?.expected_recovery ?? null,
        status: item.status,
        failed_at: item.failed_at,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
