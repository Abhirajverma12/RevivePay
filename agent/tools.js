/**
 * RevivePay Recovery Tools Definition (Pure JavaScript)
 */

function scheduleRetry(delayHours) {
  return {
    tool: 'scheduleRetry',
    status: 'QUEUED',
    parameters: { delayHours },
    description: `Queued BullMQ delayed retry in ${delayHours} hours.`,
  };
}

function retryPayment() {
  return {
    tool: 'retryPayment',
    status: 'READY',
    parameters: {},
    description: 'Triggering immediate payment gateway re-attempt.',
  };
}

function sendPaymentReminder() {
  return {
    tool: 'sendPaymentReminder',
    status: 'READY',
    parameters: {},
    description: 'Dispatching omnichannel payment reminder via SMS & Email.',
  };
}

function createPaymentLink() {
  return {
    tool: 'createPaymentLink',
    status: 'READY',
    parameters: {},
    description: 'Generating dynamic one-click payment recovery link.',
  };
}

function suggestAlternativeMethod() {
  return {
    tool: 'suggestAlternativeMethod',
    status: 'READY',
    parameters: {},
    description: 'Prompting customer with alternative payment rail (e.g. UPI QR instead of failed card).',
  };
}

function applyDiscount(pct) {
  return {
    tool: 'applyDiscount',
    status: 'CONFIGURED',
    parameters: { discountPercentage: pct },
    description: `Configured time-sensitive ${pct}% discount incentive link to recover transaction.`,
  };
}

module.exports = {
  scheduleRetry,
  retryPayment,
  sendPaymentReminder,
  createPaymentLink,
  suggestAlternativeMethod,
  applyDiscount,
};
