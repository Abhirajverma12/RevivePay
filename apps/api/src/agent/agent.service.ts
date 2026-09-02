import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecoveryPredictionService } from '../recovery/recovery-prediction.service';
import { PoliciesService } from '../policies/policies.service';
import {
  decideRecoveryAction,
  AgentContext,
  DecisionExecutionResult,
} from '@revivepay/agent';

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recoveryService: RecoveryPredictionService,
    private readonly policiesService: PoliciesService,
  ) {}

  /**
   * Run full chain: Prediction -> Guardrail Evaluation -> Agent Decision -> DB Persistence & Audit Log
   */
  async decide(failedPaymentIdOrPaymentId: string) {
    // 1. Analyze and retrieve prediction
    const analysis = await this.recoveryService.analyzePayment(failedPaymentIdOrPaymentId);
    const failedPayment = await this.prisma.failedPayment.findUnique({
      where: { id: analysis.failedPayment.id },
      include: {
        payment: {
          include: {
            customer: true,
            merchant: { include: { policy: true } },
          },
        },
        recovery_prediction: true,
      },
    });

    if (!failedPayment) {
      throw new NotFoundException(`Failed payment "${failedPaymentIdOrPaymentId}" not found`);
    }

    const customer = failedPayment.payment.customer;
    const prediction = failedPayment.recovery_prediction!;

    // 2. Evaluate Merchant Guardrail Policy
    const policyEvaluation = this.policiesService.evaluate(
      failedPayment,
      prediction,
      failedPayment.payment.merchant.policy || undefined,
    );

    // 3. Assemble Strict Agent Context
    const context: AgentContext = {
      paymentAmount: failedPayment.payment.amount,
      failureReason: failedPayment.failure_reason,
      customerLTV: customer.lifetime_value,
      successfulPayments: customer.successful_payments,
      failedPayments: customer.failed_payments,
      retryCount: failedPayment.retry_count,
      recoveryProbability: prediction.recovery_probability,
      allowedActions: policyEvaluation.allowedActions,
      requiresHumanApproval: policyEvaluation.requiresHumanApproval,
      customerName: customer.name,
    };

    // 4. Invoke AI Agent (enforces allowedActions, retry, fallback)
    const result: DecisionExecutionResult = await decideRecoveryAction(context);
    const decision = result.decision;

    // 5. Determine Action Status (PENDING_APPROVAL if high-value, else AUTO_APPROVED)
    const actionStatus = policyEvaluation.requiresHumanApproval
      ? 'PENDING_APPROVAL'
      : 'AUTO_APPROVED';

    // 6. Persist AgentAction
    const agentAction = await this.prisma.agentAction.create({
      data: {
        failed_payment_id: failedPayment.id,
        action: decision.action as any,
        delay_hours: decision.delayHours || null,
        expected_recovery: decision.expectedRecovery,
        confidence: decision.confidence,
        reason: decision.reason,
        status: actionStatus,
        decided_at: new Date(),
      },
    });

    // 7. Log every decision attempt to AuditLog
    for (const attempt of result.attempts) {
      await this.prisma.auditLog.create({
        data: {
          agent_action_id: agentAction.id,
          event: attempt.isAllowed ? 'ACTION_DECIDED' : 'ACTION_REJECTED_DISALLOWED',
          details: {
            attemptNumber: attempt.attempt,
            actionChosen: attempt.actionChosen,
            isAllowed: attempt.isAllowed,
            rejectedReason: attempt.rejectedReason || null,
            requiresHumanApproval: policyEvaluation.requiresHumanApproval,
            allowedActions: context.allowedActions,
          },
        },
      });
    }

    return {
      agentAction,
      decision,
      context,
      policyEvaluation,
      prediction,
      attempts: result.attempts,
      usedFallback: result.usedFallback,
    };
  }

  /**
   * Approves a PENDING_APPROVAL agent action
   */
  async approveAction(actionId: string) {
    const action = await this.prisma.agentAction.findUnique({
      where: { id: actionId },
    });

    if (!action) {
      throw new NotFoundException(`Agent action "${actionId}" not found`);
    }

    const updated = await this.prisma.agentAction.update({
      where: { id: actionId },
      data: { status: 'APPROVED' },
    });

    await this.prisma.auditLog.create({
      data: {
        agent_action_id: actionId,
        event: 'ACTION_MANUALLY_APPROVED',
        details: { approvedBy: 'merchant_admin', approvedAt: new Date().toISOString() },
      },
    });

    return updated;
  }

  /**
   * Activity Feed of chronological agent actions
   */
  async getActivityFeed(limit = 50) {
    return await this.prisma.agentAction.findMany({
      take: limit,
      orderBy: { decided_at: 'desc' },
      include: {
        failed_payment: {
          include: {
            payment: {
              include: {
                customer: true,
                merchant: true,
              },
            },
          },
        },
        interventions: {
          include: {
            recovery_outcome: true,
          },
        },
        audit_logs: true,
      },
    });
  }
}
