/**
 * RevivePay Recovery Tools Definition
 * 
 * Note: These tools are mapped to agent decisions and executed in Phase 6.
 * The AI Agent decides the recovery strategy, and the execution engine
 * invokes these tools accordingly.
 */

export interface ToolExecutionResult {
  tool: string;
  status: 'QUEUED' | 'READY' | 'CONFIGURED';
  parameters: Record<string, any>;
  description: string;
}

export function scheduleRetry(delayHours: number): ToolExecutionResult {
  return {
    tool: 'scheduleRetry',
    status: 'QUEUED',
    parameters: { delayHours },
    description: `Queued BullMQ delayed retry in ${delayHours} hours.`,
  };
}

export function retryPayment(): ToolExecutionResult {
  return {
    tool: 'retryPayment',
    status: 'READY',
    parameters: {},
    description: 'Triggering immediate payment gateway re-attempt.',
  };
}

export function sendPaymentReminder(): ToolExecutionResult {
  return {
    tool: 'sendPaymentReminder',
    status: 'READY',
    parameters: {},
    description: 'Dispatching omnichannel payment reminder via SMS & Email.',
  };
}

export function createPaymentLink(): ToolExecutionResult {
  return {
    tool: 'createPaymentLink',
    status: 'READY',
    parameters: {},
    description: 'Generating dynamic one-click payment recovery link.',
  };
}

export function suggestAlternativeMethod(): ToolExecutionResult {
  return {
    tool: 'suggestAlternativeMethod',
    status: 'READY',
    parameters: {},
    description: 'Prompting customer with alternative payment rail (e.g. UPI QR instead of failed card).',
  };
}

export function applyDiscount(pct: number): ToolExecutionResult {
  return {
    tool: 'applyDiscount',
    status: 'CONFIGURED',
    parameters: { discountPercentage: pct },
    description: `Configured time-sensitive ${pct}% discount incentive link to recover transaction.`,
  };
}
