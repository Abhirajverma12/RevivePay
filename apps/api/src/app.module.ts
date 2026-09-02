import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { PaymentsModule } from './payments/payments.module';
import { RecoveryModule } from './recovery/recovery.module';
import { PoliciesModule } from './policies/policies.module';
import { AgentModule } from './agent/agent.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    PaymentsModule,
    RecoveryModule,
    PoliciesModule,
    AgentModule,
    AnalyticsModule,
    AuthModule,
  ],
})
export class AppModule {}
