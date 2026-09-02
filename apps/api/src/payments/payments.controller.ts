import { Controller, Post, Body, Get, Query, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SimulateFailureDto } from './dto/simulate-failure.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('simulate-failure')
  async simulateFailure(@Body() dto: SimulateFailureDto) {
    return await this.paymentsService.simulateFailure(dto);
  }

  @Post('simulate-recovery/:interventionId')
  async simulateRecovery(@Param('interventionId') interventionId: string) {
    return await this.paymentsService.simulateRecovery(interventionId);
  }

  @Get('customers')
  async getCustomers(@Query('merchantId') merchantId?: string) {
    return await this.prisma.customer.findMany({
      where: merchantId ? { merchant_id: merchantId } : undefined,
      select: {
        id: true,
        merchant_id: true,
        name: true,
        email: true,
        lifetime_value: true,
        successful_payments: true,
        failed_payments: true,
        historical_recovery_rate: true,
      },
      take: 20,
    });
  }
}
