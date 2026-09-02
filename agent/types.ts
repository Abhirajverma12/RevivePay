import { z } from 'zod';
import { FailureReason, RecoveryStrategy } from '@prisma/client';

export const RecoveryStrategyEnum = z.enum([
  'IMMEDIATE_RETRY',
  'DELAYED_RETRY',
  'REMINDER',
  'ALTERNATIVE_METHOD',
  'PAYMENT_LINK',
  'PERSONALIZED_MESSAGE',
  'INCENTIVE',
  'NO_ACTION',
]);

export const AgentDecisionSchema = z.object({
  action: RecoveryStrategyEnum,
  delayHours: z.number().int().min(1).max(72).optional(),
  expectedRecovery: z.number().min(0),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(10),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

export interface AgentContext {
  paymentAmount: number;
  failureReason: FailureReason;
  customerLTV: number;
  successfulPayments: number;
  failedPayments: number;
  retryCount: number;
  recoveryProbability: number;
  allowedActions: RecoveryStrategy[];
  requiresHumanApproval: boolean;
  customerName?: string;
}

export interface DecisionAttemptLog {
  attempt: number;
  actionChosen: string;
  isAllowed: boolean;
  rejectedReason?: string;
}
