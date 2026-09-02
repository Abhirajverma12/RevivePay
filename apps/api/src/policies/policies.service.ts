import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FailureReason, RecoveryStrategy } from '@prisma/client';
import { UpdatePolicyDto } from './dto/update-policy.dto';

export interface PolicyEvaluationResult {
  allowedActions: RecoveryStrategy[];
  requiresHumanApproval: boolean;
  reason: string;
  policySummary: {
    maxRetries: number;
    maxDiscountPct: number;
    highValueApprovalThreshold: number;
    isHighValue: boolean;
    discountJustified: boolean;
  };
}

export interface FailedPaymentInput {
  id?: string;
  paymentId?: string;
  failure_reason: FailureReason;
  retry_count: number;
  payment?: {
    amount: number;
  };
  amount?: number;
}

export interface PredictionInput {
  recovery_probability: number;
  expected_recovery: number;
}

export interface PolicyInput {
  max_retries: number;
  max_discount_pct: number;
  high_value_approval_threshold: number;
}

const TEMPORARY_REASONS = new Set<FailureReason>([
  FailureReason.NETWORK_ERROR,
  FailureReason.INSUFFICIENT_FUNDS,
  FailureReason.BANK_ERROR,
]);

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure evaluation function implementing the guardrail logic outside of the AI agent
   */
  evaluate(
    failedPayment: FailedPaymentInput,
    prediction: PredictionInput,
    policy?: Partial<PolicyInput>,
  ): PolicyEvaluationResult {
    const amount = failedPayment.payment?.amount ?? failedPayment.amount ?? 0;
    const retryCount = failedPayment.retry_count ?? 0;
    const failureReason = failedPayment.failure_reason;
    const probability = prediction.recovery_probability ?? 0;
    const expectedRecovery = prediction.expected_recovery ?? (amount * probability);

    const maxRetries = policy?.max_retries ?? 3;
    const maxDiscountPct = policy?.max_discount_pct ?? 15.0;
    const highValueThreshold = policy?.high_value_approval_threshold ?? 50000.0;

    const isTemporary = TEMPORARY_REASONS.has(failureReason);
    const isHighValue = amount > highValueThreshold;
    const discountCost = amount * (maxDiscountPct / 100);
    const discountJustified = (expectedRecovery * 0.5) > discountCost;

    // 1. High-Value Guardrail (Mandatory human approval)
    const requiresHumanApproval = isHighValue;

    // 2. Action Determination
    let allowedActions: RecoveryStrategy[] = [];
    let reason = '';

    if (probability < 0.30) {
      // Very low probability: strictly NO_ACTION
      allowedActions = [RecoveryStrategy.NO_ACTION];
      reason = `Recovery probability (${(probability * 100).toFixed(1)}% < 30%) is too low to expend merchant resources. Guardrails permit only NO_ACTION.`;
    } else if (probability > 0.80 && retryCount === 0 && isTemporary) {
      // High probability temporary failure with 0 retries
      allowedActions = [RecoveryStrategy.IMMEDIATE_RETRY, RecoveryStrategy.DELAYED_RETRY];
      reason = `High recovery probability (${(probability * 100).toFixed(1)}%) with temporary reason (${failureReason}) and 0 retries permits immediate or delayed retry.`;
    } else if (probability >= 0.50) {
      // Moderate-to-high probability
      allowedActions = [
        RecoveryStrategy.REMINDER,
        RecoveryStrategy.PAYMENT_LINK,
        RecoveryStrategy.ALTERNATIVE_METHOD,
        RecoveryStrategy.PERSONALIZED_MESSAGE,
      ];
      if (retryCount < maxRetries && isTemporary) {
        allowedActions.unshift(RecoveryStrategy.DELAYED_RETRY);
      }
      reason = `Recovery probability (${(probability * 100).toFixed(1)}%) qualifies for customer messaging and payment link interventions.`;
    } else {
      // Low-to-moderate probability (0.30 <= probability < 0.50)
      allowedActions = [
        RecoveryStrategy.ALTERNATIVE_METHOD,
        RecoveryStrategy.PAYMENT_LINK,
        RecoveryStrategy.NO_ACTION,
      ];
      reason = `Sub-50% probability (${(probability * 100).toFixed(1)}%) restricts actions to alternative method suggestions or no-action.`;
    }

    // 3. Retry Limit Enforcement
    if (retryCount >= maxRetries) {
      allowedActions = allowedActions.filter(
        (a) => a !== RecoveryStrategy.IMMEDIATE_RETRY && a !== RecoveryStrategy.DELAYED_RETRY,
      );
      if (allowedActions.length === 0) {
        allowedActions = [RecoveryStrategy.NO_ACTION];
      }
    }

    // 4. INCENTIVE Guardrail: Exclude unless discount cost is mathematically justified
    if (discountJustified && probability >= 0.50) {
      if (!allowedActions.includes(RecoveryStrategy.INCENTIVE)) {
        allowedActions.push(RecoveryStrategy.INCENTIVE);
      }
    } else {
      // Ensure INCENTIVE is strictly excluded
      allowedActions = allowedActions.filter((a) => a !== RecoveryStrategy.INCENTIVE);
    }

    if (requiresHumanApproval) {
      reason += ` Transaction amount (₹${amount.toLocaleString()}) exceeds merchant approval threshold (₹${highValueThreshold.toLocaleString()}) — requires explicit human sign-off.`;
    }

    return {
      allowedActions,
      requiresHumanApproval,
      reason,
      policySummary: {
        maxRetries,
        maxDiscountPct,
        highValueApprovalThreshold: highValueThreshold,
        isHighValue,
        discountJustified,
      },
    };
  }

  /**
   * Database helper: evaluate policy for a specific failed payment
   */
  async evaluateForPayment(paymentIdOrFailedPaymentId: string): Promise<PolicyEvaluationResult> {
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
            merchant: {
              include: { policy: true },
            },
          },
        },
        recovery_prediction: true,
      },
    });

    if (!failedPayment) {
      throw new NotFoundException(`Failed payment not found for identifier "${paymentIdOrFailedPaymentId}"`);
    }

    const prediction = failedPayment.recovery_prediction || {
      recovery_probability: 0.50,
      expected_recovery: failedPayment.payment.amount * 0.50,
    };

    const policy = failedPayment.payment.merchant.policy || {
      max_retries: 3,
      max_discount_pct: 15.0,
      high_value_approval_threshold: 50000.0,
    };

    return this.evaluate(failedPayment, prediction, policy);
  }

  /**
   * List all policies or policy for specific merchant
   */
  async getPolicies(merchantId?: string) {
    return await this.prisma.merchantPolicy.findMany({
      where: merchantId ? { merchant_id: merchantId } : undefined,
      include: {
        merchant: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Update policy for a merchant
   */
  async updatePolicy(merchantId: string, dto: UpdatePolicyDto) {
    if (!merchantId) {
      throw new BadRequestException('merchantId is required');
    }

    const existing = await this.prisma.merchantPolicy.findUnique({
      where: { merchant_id: merchantId },
    });

    if (!existing) {
      throw new NotFoundException(`Policy not found for merchant ID "${merchantId}"`);
    }

    return await this.prisma.merchantPolicy.update({
      where: { merchant_id: merchantId },
      data: {
        max_retries: dto.max_retries !== undefined ? Number(dto.max_retries) : undefined,
        max_discount_pct: dto.max_discount_pct !== undefined ? Number(dto.max_discount_pct) : undefined,
        high_value_approval_threshold:
          dto.high_value_approval_threshold !== undefined
            ? Number(dto.high_value_approval_threshold)
            : undefined,
      },
      include: {
        merchant: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
}
