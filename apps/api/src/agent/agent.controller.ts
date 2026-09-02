import { Controller, Post, Get, Param, Query } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('decide/:failedPaymentId')
  async decide(@Param('failedPaymentId') failedPaymentId: string) {
    return await this.agentService.decide(failedPaymentId);
  }

  @Post('approve/:actionId')
  async approveAction(@Param('actionId') actionId: string) {
    return await this.agentService.approveAction(actionId);
  }

  @Get('activity')
  async getActivityFeed(@Query('limit') limit?: string) {
    return await this.agentService.getActivityFeed(limit ? parseInt(limit, 10) : 50);
  }
}
