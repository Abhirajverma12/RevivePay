import { Module, forwardRef } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { RecoveryModule } from '../recovery/recovery.module';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [forwardRef(() => RecoveryModule), PoliciesModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
