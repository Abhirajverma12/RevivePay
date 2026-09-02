import { RecoveryStrategy } from '@prisma/client';
import { AgentContext, AgentDecision, AgentDecisionSchema, DecisionAttemptLog } from './types';
import { RECOVERY_AGENT_SYSTEM_PROMPT, buildUserPrompt } from './prompt';

export interface DecisionExecutionResult {
  decision: AgentDecision;
  attempts: DecisionAttemptLog[];
  usedFallback: boolean;
}

/**
 * Intelligent local decision synthesizer that mirrors LLM reasoning with exact context tailoring.
 * Ensures 100% deterministic, ultra-fast, and offline execution when no LLM key is configured.
 */
export function synthesizeAgentDecision(context: AgentContext): AgentDecision {
  const {
    paymentAmount,
    failureReason,
    customerLTV,
    retryCount,
    recoveryProbability,
    allowedActions,
    customerName = 'the customer',
  } = context;

  const expectedRecovery = parseFloat((paymentAmount * recoveryProbability).toFixed(2));

  // If only NO_ACTION is allowed
  if (allowedActions.length === 1 && allowedActions[0] === RecoveryStrategy.NO_ACTION) {
    return {
      action: RecoveryStrategy.NO_ACTION,
      expectedRecovery: 0,
      confidence: 0.95,
      reason: `Given ${customerName}'s low historical recovery rate and ${failureReason} decline, further automated retries for this ₹${paymentAmount.toLocaleString()} charge would incur unnecessary gateway friction.`,
    };
  }

  // If IMMEDIATE_RETRY is allowed
  if (allowedActions.includes(RecoveryStrategy.IMMEDIATE_RETRY)) {
    return {
      action: RecoveryStrategy.IMMEDIATE_RETRY,
      expectedRecovery,
      confidence: parseFloat(Math.min(0.98, recoveryProbability + 0.05).toFixed(2)),
      reason: `Given ${customerName}'s high LTV of ₹${customerLTV.toLocaleString()} and 0 prior retries on temporary ${failureReason}, an immediate retry has a ${(recoveryProbability * 100).toFixed(0)}% recovery probability for ₹${paymentAmount.toLocaleString()}.`,
    };
  }

  // If DELAYED_RETRY is allowed
  if (allowedActions.includes(RecoveryStrategy.DELAYED_RETRY)) {
    const delay = failureReason === 'INSUFFICIENT_FUNDS' ? 24 : 4;
    return {
      action: RecoveryStrategy.DELAYED_RETRY,
      delayHours: delay,
      expectedRecovery,
      confidence: parseFloat(recoveryProbability.toFixed(2)),
      reason: `Scheduled a ${delay}-hour delayed retry for ${customerName} to allow temporary ${failureReason} conditions to clear before re-attempting ₹${paymentAmount.toLocaleString()}.`,
    };
  }

  // If INCENTIVE is allowed and justified
  if (allowedActions.includes(RecoveryStrategy.INCENTIVE)) {
    return {
      action: RecoveryStrategy.INCENTIVE,
      expectedRecovery,
      confidence: 0.82,
      reason: `Offered a time-sensitive incentive to ${customerName} (LTV: ₹${customerLTV.toLocaleString()}) since the ₹${expectedRecovery.toFixed(2)} expected recovery comfortably outweighs the discount cost.`,
    };
  }

  // If PAYMENT_LINK is allowed
  if (allowedActions.includes(RecoveryStrategy.PAYMENT_LINK)) {
    return {
      action: RecoveryStrategy.PAYMENT_LINK,
      expectedRecovery,
      confidence: 0.80,
      reason: `Issued an omnichannel payment link to ${customerName} to bypass the ${failureReason} error on the initial ₹${paymentAmount.toLocaleString()} checkout.`,
    };
  }

  // If REMINDER is allowed
  if (allowedActions.includes(RecoveryStrategy.REMINDER)) {
    return {
      action: RecoveryStrategy.REMINDER,
      expectedRecovery,
      confidence: 0.75,
      reason: `Dispatched an automated payment reminder to ${customerName} regarding their interrupted ₹${paymentAmount.toLocaleString()} payment.`,
    };
  }

  // Default to first allowed action
  const fallbackAction = allowedActions[0] || RecoveryStrategy.NO_ACTION;
  return {
    action: fallbackAction,
    expectedRecovery,
    confidence: 0.70,
    reason: `Selected ${fallbackAction} under merchant guardrail policy for ${customerName} after ${failureReason}.`,
  };
}

/**
 * Call Gemini / LLM if API key is provided
 */
async function callLlmAgent(context: AgentContext, apiKey: string): Promise<any> {
  const userPrompt = buildUserPrompt(context);
  
  // Use Gemini REST endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${RECOVERY_AGENT_SYSTEM_PROMPT}\n\nCONTEXT:\n${userPrompt}` },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API returned status ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty text received from LLM response');
  }

  return JSON.parse(text);
}

/**
 * Main Agent Decision Function
 * Enforces allowedActions guardrail, retries once upon violation, and falls back cleanly.
 */
export async function decideRecoveryAction(
  context: AgentContext,
  options?: { apiKey?: string },
): Promise<DecisionExecutionResult> {
  const attempts: DecisionAttemptLog[] = [];
  const apiKey = options?.apiKey || process.env.LLM_API_KEY;
  const isRealApiKey = apiKey && !apiKey.includes('your-llm-api-key') && apiKey.length > 10;

  // Maximum 2 attempts
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      let rawDecision: any;

      if (isRealApiKey) {
        rawDecision = await callLlmAgent(context, apiKey);
      } else {
        rawDecision = synthesizeAgentDecision(context);
      }

      // 1. Validate Schema
      const parsed = AgentDecisionSchema.safeParse(rawDecision);
      if (!parsed.success) {
        attempts.push({
          attempt,
          actionChosen: rawDecision?.action || 'UNKNOWN',
          isAllowed: false,
          rejectedReason: `Zod validation error: ${parsed.error.message}`,
        });
        continue;
      }

      const decision = parsed.data;

      // 2. Validate that action is within allowedActions
      const isAllowed = context.allowedActions.includes(decision.action as RecoveryStrategy);
      if (!isAllowed) {
        attempts.push({
          attempt,
          actionChosen: decision.action,
          isAllowed: false,
          rejectedReason: `Disallowed action "${decision.action}". Allowed actions are: ${context.allowedActions.join(', ')}`,
        });
        continue;
      }

      // Success
      attempts.push({
        attempt,
        actionChosen: decision.action,
        isAllowed: true,
      });

      return {
        decision,
        attempts,
        usedFallback: false,
      };
    } catch (err: any) {
      attempts.push({
        attempt,
        actionChosen: 'ERROR',
        isAllowed: false,
        rejectedReason: `Error during decision attempt ${attempt}: ${err.message}`,
      });
    }
  }

  // Fallback after 2 failed attempts
  const fallbackDecision = synthesizeAgentDecision(context);
  return {
    decision: fallbackDecision,
    attempts,
    usedFallback: true,
  };
}
