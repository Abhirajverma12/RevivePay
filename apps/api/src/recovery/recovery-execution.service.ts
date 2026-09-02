import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecoveryPredictionService } from './recovery-prediction.service';
import { AgentService } from '../agent/agent.service';
import { RecoveryStrategy, FailureReason } from '@prisma/client';
import { simulateRecoveryResult } from '@revivepay/simulator';
import { enqueueDelayedRetry } from '@revivepay/workers';

export interface RecoverPaymentOptions {
  actionId?: string;
  forceImmediateForDemo?: boolean;
}

@Injectable()
export class RecoveryExecutionService {
  private readonly logger = new Logger(RecoveryExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recoveryService: RecoveryPredictionService,
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService,
  ) {}

  /**
   * Executes the recovery action for a given payment
   */
  async recoverPayment(paymentIdOrFailedPaymentId: string, options?: RecoverPaymentOptions) {
    // 1. Locate failed payment and ensure it has an action
    let failedPayment = await this.prisma.failedPayment.findFirst({
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
            merchant: { include: { policy: true } },
          },
        },
        recovery_prediction: true,
        agent_actions: {
          orderBy: { decided_at: 'desc' },
        },
      },
    });

    if (!failedPayment) {
      throw new NotFoundException(`Failed payment "${paymentIdOrFailedPaymentId}" not found`);
    }

    // 2. Resolve AgentAction
    let agentAction = options?.actionId
      ? failedPayment.agent_actions.find((a) => a.id === options.actionId)
      : failedPayment.agent_actions[0];

    // If no action exists yet, run AI agent decision first
    if (!agentAction) {
      this.logger.log(`No existing action found for payment ${failedPayment.id}. Invoking agent decision first.`);
      const decisionResult = await this.agentService.decide(failedPayment.id);
      agentAction = decisionResult.agentAction;
    }

    // 3. Guardrail Check: Ensure action is approved
    if (agentAction.status === 'PENDING_APPROVAL') {
      throw new BadRequestException(
        `Action "${agentAction.action}" requires manual merchant approval before execution. Please approve it first via /api/agent/approve/${agentAction.id}.`,
      );
    }

    // 4. Create initial Intervention row
    const intervention = await this.prisma.intervention.create({
      data: {
        agent_action_id: agentAction.id,
        status: 'IN_PROGRESS',
        executed_at: new Date(),
        details: {
          action: agentAction.action,
          strategy: agentAction.action,
          triggeredAt: new Date().toISOString(),
          customerName: failedPayment.payment.customer.name,
          paymentAmount: failedPayment.payment.amount,
        },
      },
    });

    try {
      // 5. Execute matching recovery tool
      const executionResult = await this.executeToolStrategy(
        agentAction,
        failedPayment,
        intervention.id,
        options?.forceImmediateForDemo ?? true, // default to true for interactive demo responsiveness
      );

      // 6. Update Intervention status & details
      const updatedIntervention = await this.prisma.intervention.update({
        where: { id: intervention.id },
        data: {
          status: executionResult.interventionStatus,
          details: {
            ...(typeof intervention.details === 'object' && intervention.details ? intervention.details : {}),
            ...executionResult.details,
          },
        },
        include: {
          recovery_outcome: true,
        },
      });

      // 7. Update AgentAction status to EXECUTED
      await this.prisma.agentAction.update({
        where: { id: agentAction.id },
        data: { status: 'EXECUTED' },
      });

      // 8. Log Execution Audit Trail
      await this.prisma.auditLog.create({
        data: {
          agent_action_id: agentAction.id,
          event: 'INTERVENTION_EXECUTED',
          details: {
            interventionId: intervention.id,
            action: agentAction.action,
            recovered: executionResult.outcome?.recovered ?? false,
            amountRecovered: executionResult.outcome?.amount_recovered ?? 0,
          },
        },
      });

      return {
        success: true,
        intervention: updatedIntervention,
        outcome: executionResult.outcome,
        agentAction,
        payment: {
          id: failedPayment.payment.id,
          amount: failedPayment.payment.amount,
          status: executionResult.outcome?.recovered ? 'RECOVERED' : failedPayment.payment.status,
        },
        message: executionResult.message,
      };
    } catch (err: any) {
      this.logger.error(`Recovery execution failed for intervention ${intervention.id}:`, err);

      // Handle failure gracefully without crashing
      await this.prisma.intervention.update({
        where: { id: intervention.id },
        data: {
          status: 'FAILED',
          details: {
            ...(typeof intervention.details === 'object' && intervention.details ? intervention.details : {}),
            error: err.message,
            failedAt: new Date().toISOString(),
          },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          agent_action_id: agentAction.id,
          event: 'INTERVENTION_EXECUTION_FAILED',
          details: { error: err.message },
        },
      });

      return {
        success: false,
        interventionId: intervention.id,
        error: err.message,
      };
    }
  }

  /**
   * Tool execution handler mapping strategy to concrete simulator / worker / links
   */
  private async executeToolStrategy(
    agentAction: any,
    failedPayment: any,
    interventionId: string,
    forceImmediateForDemo = true,
  ) {
    const action = agentAction.action as RecoveryStrategy;
    const amount = failedPayment.payment.amount;
    const customer = failedPayment.payment.customer;

    switch (action) {
      case RecoveryStrategy.IMMEDIATE_RETRY: {
        // Direct gateway retry simulation
        const simResult = await simulateRecoveryResult(this.prisma, interventionId);
        const outcome = await this.prisma.recoveryOutcome.findUnique({
          where: { intervention_id: interventionId },
        });

        return {
          interventionStatus: 'COMPLETED',
          outcome,
          message: simResult.recovered
            ? `Immediate retry succeeded! Recovered ₹${amount.toLocaleString()} through primary payment rail.`
            : `Immediate retry failed. Gateway returned temporary decline.`,
          details: {
            tool: 'retryPayment',
            recovered: simResult.recovered,
            gatewayResponseCode: simResult.recovered ? 'AUTH_200_SUCCESS' : 'DECLINE_902_RETRY_EXHAUSTED',
          },
        };
      }

      case RecoveryStrategy.DELAYED_RETRY: {
        const delayHours = agentAction.delay_hours || 24;

        // Enqueue delayed job in BullMQ
        const queueJob = await enqueueDelayedRetry(
          {
            interventionId,
            failedPaymentId: failedPayment.id,
            delayHours,
          },
          forceImmediateForDemo ? 1000 : undefined, // 1s for immediate demo if requested
        );

        if (forceImmediateForDemo) {
          // Resolve immediately for demo feedback
          const simResult = await simulateRecoveryResult(this.prisma, interventionId);
          const outcome = await this.prisma.recoveryOutcome.findUnique({
            where: { intervention_id: interventionId },
          });

          return {
            interventionStatus: 'COMPLETED',
            outcome,
            message: `Processed delayed retry (${delayHours}h window). Simulation result: ${simResult.recovered ? 'Recovered' : 'Unrecovered'}.`,
            details: {
              tool: 'scheduleRetry',
              delayHours,
              bullMqJobId: queueJob.jobId,
              scheduledFor: queueJob.scheduledFor,
              recovered: simResult.recovered,
            },
          };
        } else {
          return {
            interventionStatus: 'PENDING',
            outcome: null,
            message: `Delayed retry successfully queued in BullMQ for execution in ${delayHours} hours.`,
            details: {
              tool: 'scheduleRetry',
              delayHours,
              bullMqJobId: queueJob.jobId,
              scheduledFor: queueJob.scheduledFor,
            },
          };
        }
      }

      case RecoveryStrategy.PAYMENT_LINK: {
        const paymentLinkUrl = `https://rzp.io/i/sim_revive_${failedPayment.id.slice(0, 8)}`;
        const simResult = await simulateRecoveryResult(this.prisma, interventionId);
        const outcome = await this.prisma.recoveryOutcome.findUnique({
          where: { intervention_id: interventionId },
        });

        return {
          interventionStatus: 'COMPLETED',
          outcome,
          message: simResult.recovered
            ? `Customer paid via generated Razorpay recovery link (${paymentLinkUrl})! Recovered ₹${amount.toLocaleString()}.`
            : `Payment link generated (${paymentLinkUrl}). Customer viewed but did not complete transaction.`,
          details: {
            tool: 'createPaymentLink',
            paymentLink: paymentLinkUrl,
            recovered: simResult.recovered,
          },
        };
      }

      case RecoveryStrategy.INCENTIVE: {
        const discountPct = 10;
        const discountedAmount = amount * (1 - discountPct / 100);
        const paymentLinkUrl = `https://rzp.io/i/sim_revive_disc_${failedPayment.id.slice(0, 8)}`;

        const simResult = await simulateRecoveryResult(this.prisma, interventionId);
        const outcome = await this.prisma.recoveryOutcome.findUnique({
          where: { intervention_id: interventionId },
        });

        return {
          interventionStatus: 'COMPLETED',
          outcome,
          message: simResult.recovered
            ? `Customer converted with ${discountPct}% incentive discount! Recovered ₹${amount.toLocaleString()}.`
            : `Incentive link dispatched with ${discountPct}% off. Customer has not redeemed.`,
          details: {
            tool: 'applyDiscount',
            discountPercentage: discountPct,
            discountedAmount,
            paymentLink: paymentLinkUrl,
            recovered: simResult.recovered,
          },
        };
      }

      case RecoveryStrategy.REMINDER:
      case RecoveryStrategy.PERSONALIZED_MESSAGE: {
        const simResult = await simulateRecoveryResult(this.prisma, interventionId);
        const outcome = await this.prisma.recoveryOutcome.findUnique({
          where: { intervention_id: interventionId },
        });

        return {
          interventionStatus: 'COMPLETED',
          outcome,
          message: simResult.recovered
            ? `Omnichannel notification dispatched to ${customer.email}. Customer completed recovery payment.`
            : `Notification dispatched to ${customer.email}. Awaiting customer response.`,
          details: {
            tool: 'sendPaymentReminder',
            recipient: customer.email,
            channel: 'SMS_AND_EMAIL',
            recovered: simResult.recovered,
          },
        };
      }

      case RecoveryStrategy.ALTERNATIVE_METHOD: {
        const simResult = await simulateRecoveryResult(this.prisma, interventionId);
        const outcome = await this.prisma.recoveryOutcome.findUnique({
          where: { intervention_id: interventionId },
        });

        return {
          interventionStatus: 'COMPLETED',
          outcome,
          message: simResult.recovered
            ? `Customer accepted alternative payment method (UPI Instant) and recovered ₹${amount.toLocaleString()}!`
            : `Alternative method prompt shown to customer. Transaction pending.`,
          details: {
            tool: 'suggestAlternativeMethod',
            suggestedMethod: 'UPI_QR',
            recovered: simResult.recovered,
          },
        };
      }

      case RecoveryStrategy.NO_ACTION:
      default: {
        // Mark as SKIPPED
        const outcome = await this.prisma.recoveryOutcome.upsert({
          where: { intervention_id: interventionId },
          create: {
            intervention_id: interventionId,
            recovered: false,
            amount_recovered: 0,
            resolved_at: new Date(),
            notes: 'No active recovery executed per merchant guardrail policy.',
          },
          update: {
            recovered: false,
            amount_recovered: 0,
            resolved_at: new Date(),
            notes: 'No active recovery executed per merchant guardrail policy.',
          },
        });

        return {
          interventionStatus: 'SKIPPED',
          outcome,
          message: 'No intervention executed per policy guardrail. Transaction skipped.',
          details: {
            tool: 'none',
            reason: 'NO_ACTION_PERMITTED',
            recovered: false,
          },
        };
      }
    }
  }
}
