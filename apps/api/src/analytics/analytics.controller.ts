import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue')
  async getRevenue(@Query('merchantId') merchantId?: string) {
    return await this.analyticsService.getRevenueAnalytics(merchantId);
  }

  @Get('strategies')
  async getStrategies(@Query('merchantId') merchantId?: string) {
    return await this.analyticsService.getStrategyAnalytics(merchantId);
  }

  @Get('failure-reasons')
  async getFailureReasons(@Query('merchantId') merchantId?: string) {
    return await this.analyticsService.getFailureReasonAnalytics(merchantId);
  }
}
