import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecoveryStrategy, FailureReason } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Live aggregate revenue recovery metrics
   */
  async getRevenueAnalytics(merchantId?: string) {
    const merchantFilter = merchantId ? { payment: { merchant_id: merchantId } } : {};

    // 1. Fetch all failed payments with payments
    const failedPayments = await this.prisma.failedPayment.findMany({
      where: merchantFilter,
      include: {
        payment: true,
      },
    });

    const totalFailedCount = failedPayments.length;
    const revenueAtRisk = failedPayments.reduce((sum, fp) => sum + fp.payment.amount, 0);

    const recoveredPayments = failedPayments.filter((fp) => fp.status === 'RECOVERED');
    const recoveredCount = recoveredPayments.length;

    const pendingRecoveries = failedPayments.filter(
      (fp) => fp.status === 'UNRESOLVED' || fp.status === 'IN_RECOVERY',
    ).length;

    // 2. Fetch all successful recovery outcomes for accurate amount recovered
    const outcomes = await this.prisma.recoveryOutcome.findMany({
      where: {
        recovered: true,
        intervention: {
          agent_action: {
            failed_payment: merchantFilter,
          },
        },
      },
    });

    const recoveredRevenue = outcomes.reduce((sum, o) => sum + o.amount_recovered, 0);
    const recoveryRate = totalFailedCount > 0 ? parseFloat((recoveredCount / totalFailedCount).toFixed(4)) : 0;
    const monetaryRecoveryRate = revenueAtRisk > 0 ? parseFloat((recoveredRevenue / revenueAtRisk).toFixed(4)) : 0;

    return {
      revenueAtRisk: parseFloat(revenueAtRisk.toFixed(2)),
      recoveredRevenue: parseFloat(recoveredRevenue.toFixed(2)),
      recoveryRate,
      monetaryRecoveryRate,
      pendingRecoveries,
      totalFailedCount,
      recoveredCount,
    };
  }

  /**
   * Strategy performance breakdown across the 8 recovery strategies
   */
  async getStrategyAnalytics(merchantId?: string) {
    const merchantFilter = merchantId
      ? { failed_payment: { payment: { merchant_id: merchantId } } }
      : {};

    const actions = await this.prisma.agentAction.findMany({
      where: merchantFilter,
      include: {
        interventions: {
          include: {
            recovery_outcome: true,
          },
        },
      },
    });

    const allStrategies = Object.values(RecoveryStrategy);
    const statsMap = new Map<
      RecoveryStrategy,
      { attempts: number; recovered: number; amountRecovered: number }
    >();

    for (const strat of allStrategies) {
      statsMap.set(strat, { attempts: 0, recovered: 0, amountRecovered: 0 });
    }

    for (const action of actions) {
      const current = statsMap.get(action.action) || { attempts: 0, recovered: 0, amountRecovered: 0 };
      current.attempts += 1;

      for (const intervention of action.interventions) {
        if (intervention.recovery_outcome?.recovered) {
          current.recovered += 1;
          current.amountRecovered += intervention.recovery_outcome.amount_recovered;
        }
      }
      statsMap.set(action.action, current);
    }

    return Array.from(statsMap.entries()).map(([strategy, stat]) => ({
      action: strategy,
      attempts: stat.attempts,
      recovered: stat.recovered,
      successRate: stat.attempts > 0 ? parseFloat((stat.recovered / stat.attempts).toFixed(2)) : 0,
      amountRecovered: parseFloat(stat.amountRecovered.toFixed(2)),
    }));
  }

  /**
   * Failure reason breakdown (frequency, amount, and recovery rate)
   */
  async getFailureReasonAnalytics(merchantId?: string) {
    const merchantFilter = merchantId ? { payment: { merchant_id: merchantId } } : {};

    const failedPayments = await this.prisma.failedPayment.findMany({
      where: merchantFilter,
      include: { payment: true },
    });

    const allReasons = Object.values(FailureReason);
    const map = new Map<
      FailureReason,
      { count: number; recoveredCount: number; totalAmount: number }
    >();

    for (const r of allReasons) {
      map.set(r, { count: 0, recoveredCount: 0, totalAmount: 0 });
    }

    for (const fp of failedPayments) {
      const stat = map.get(fp.failure_reason) || { count: 0, recoveredCount: 0, totalAmount: 0 };
      stat.count += 1;
      stat.totalAmount += fp.payment.amount;
      if (fp.status === 'RECOVERED') {
        stat.recoveredCount += 1;
      }
      map.set(fp.failure_reason, stat);
    }

    return Array.from(map.entries())
      .map(([reason, stat]) => ({
        failureReason: reason,
        count: stat.count,
        recoveredCount: stat.recoveredCount,
        recoveryRate: stat.count > 0 ? parseFloat((stat.recoveredCount / stat.count).toFixed(2)) : 0,
        totalAmount: parseFloat(stat.totalAmount.toFixed(2)),
      }))
      .sort((a, b) => b.count - a.count);
  }
}
