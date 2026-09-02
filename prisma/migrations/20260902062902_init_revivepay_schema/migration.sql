-- CreateEnum
CREATE TYPE "FailureReason" AS ENUM ('INSUFFICIENT_FUNDS', 'CARD_DECLINED', 'EXPIRED_CARD', 'NETWORK_ERROR', 'BANK_ERROR', 'AUTHENTICATION_FAILED');

-- CreateEnum
CREATE TYPE "RecoveryStrategy" AS ENUM ('IMMEDIATE_RETRY', 'DELAYED_RETRY', 'REMINDER', 'ALTERNATIVE_METHOD', 'PAYMENT_LINK', 'PERSONALIZED_MESSAGE', 'INCENTIVE', 'NO_ACTION');

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_policies" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "max_discount_pct" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "high_value_approval_threshold" DOUBLE PRECISION NOT NULL DEFAULT 50000.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "lifetime_value" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "successful_payments" INTEGER NOT NULL DEFAULT 0,
    "failed_payments" INTEGER NOT NULL DEFAULT 0,
    "historical_recovery_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_payments" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "failure_reason" "FailureReason" NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
    "failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_predictions" (
    "id" TEXT NOT NULL,
    "failed_payment_id" TEXT NOT NULL,
    "recovery_probability" DOUBLE PRECISION NOT NULL,
    "expected_recovery" DOUBLE PRECISION NOT NULL,
    "model_version" TEXT NOT NULL DEFAULT 'rule-based-v1',
    "factor_scores" JSONB,
    "predicted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" TEXT NOT NULL,
    "failed_payment_id" TEXT NOT NULL,
    "action" "RecoveryStrategy" NOT NULL,
    "delay_hours" INTEGER,
    "expected_recovery" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AUTO_APPROVED',
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "agent_action_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_outcomes" (
    "id" TEXT NOT NULL,
    "intervention_id" TEXT NOT NULL,
    "recovered" BOOLEAN NOT NULL,
    "amount_recovered" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "resolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "recovery_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "agent_action_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchants_email_key" ON "merchants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_policies_merchant_id_key" ON "merchant_policies"("merchant_id");

-- CreateIndex
CREATE INDEX "customers_merchant_id_idx" ON "customers"("merchant_id");

-- CreateIndex
CREATE INDEX "payments_merchant_id_idx" ON "payments"("merchant_id");

-- CreateIndex
CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payment_attempts_payment_id_idx" ON "payment_attempts"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "failed_payments_payment_id_key" ON "failed_payments"("payment_id");

-- CreateIndex
CREATE INDEX "failed_payments_payment_id_idx" ON "failed_payments"("payment_id");

-- CreateIndex
CREATE INDEX "failed_payments_failed_at_idx" ON "failed_payments"("failed_at");

-- CreateIndex
CREATE INDEX "failed_payments_failure_reason_idx" ON "failed_payments"("failure_reason");

-- CreateIndex
CREATE INDEX "failed_payments_status_idx" ON "failed_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_predictions_failed_payment_id_key" ON "recovery_predictions"("failed_payment_id");

-- CreateIndex
CREATE INDEX "recovery_predictions_failed_payment_id_idx" ON "recovery_predictions"("failed_payment_id");

-- CreateIndex
CREATE INDEX "agent_actions_failed_payment_id_idx" ON "agent_actions"("failed_payment_id");

-- CreateIndex
CREATE INDEX "agent_actions_decided_at_idx" ON "agent_actions"("decided_at");

-- CreateIndex
CREATE INDEX "agent_actions_action_idx" ON "agent_actions"("action");

-- CreateIndex
CREATE INDEX "agent_actions_status_idx" ON "agent_actions"("status");

-- CreateIndex
CREATE INDEX "interventions_agent_action_id_idx" ON "interventions"("agent_action_id");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_outcomes_intervention_id_key" ON "recovery_outcomes"("intervention_id");

-- CreateIndex
CREATE INDEX "recovery_outcomes_intervention_id_idx" ON "recovery_outcomes"("intervention_id");

-- CreateIndex
CREATE INDEX "audit_logs_agent_action_id_idx" ON "audit_logs"("agent_action_id");

-- AddForeignKey
ALTER TABLE "merchant_policies" ADD CONSTRAINT "merchant_policies_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_payments" ADD CONSTRAINT "failed_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_predictions" ADD CONSTRAINT "recovery_predictions_failed_payment_id_fkey" FOREIGN KEY ("failed_payment_id") REFERENCES "failed_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_failed_payment_id_fkey" FOREIGN KEY ("failed_payment_id") REFERENCES "failed_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_agent_action_id_fkey" FOREIGN KEY ("agent_action_id") REFERENCES "agent_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_outcomes" ADD CONSTRAINT "recovery_outcomes_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agent_action_id_fkey" FOREIGN KEY ("agent_action_id") REFERENCES "agent_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
