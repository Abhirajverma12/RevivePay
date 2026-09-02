import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common';
import { RecoveryPredictionService } from './recovery-prediction.service';
import { RecoveryExecutionService } from './recovery-execution.service';

@Controller('recovery')
export class RecoveryController {
  constructor(
    private readonly recoveryService: RecoveryPredictionService,
    private readonly executionService: RecoveryExecutionService,
  ) {}

  @Post(':paymentId/analyze')
  async analyzePayment(@Param('paymentId') paymentId: string) {
    return await this.recoveryService.analyzePayment(paymentId);
  }

  @Post(':paymentId/recover')
  async recoverPayment(
    @Param('paymentId') paymentId: string,
    @Body() body?: { actionId?: string; forceImmediateForDemo?: boolean },
  ) {
    return await this.executionService.recoverPayment(paymentId, body);
  }

  @Get('failed-payments')
  async getFailedPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('merchantId') merchantId?: string,
    @Query('failureReason') failureReason?: any,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return await this.recoveryService.getFailedPayments({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      merchantId,
      failureReason,
      status,
      startDate,
      endDate,
      search,
    });
  }

  @Get(':paymentId')
  async getPaymentDetails(@Param('paymentId') paymentId: string) {
    return await this.recoveryService.getPaymentDetails(paymentId);
  }
}
