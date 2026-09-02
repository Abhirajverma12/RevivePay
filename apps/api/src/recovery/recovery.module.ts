import { Module, forwardRef } from '@nestjs/common';
import { RecoveryController } from './recovery.controller';
import { RecoveryPredictionService } from './recovery-prediction.service';
import { RecoveryExecutionService } from './recovery-execution.service';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [forwardRef(() => AgentModule)],
  controllers: [RecoveryController],
  providers: [RecoveryPredictionService, RecoveryExecutionService],
  exports: [RecoveryPredictionService, RecoveryExecutionService],
})
export class RecoveryModule {}
