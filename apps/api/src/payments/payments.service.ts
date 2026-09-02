import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimulateFailureDto } from './dto/simulate-failure.dto';
import {
  simulateFailedPayment,
  simulateRecoveryResult,
  SimulateFailedPaymentResult,
  SimulateRecoveryResult,
} from '@revivepay/simulator';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async simulateFailure(dto: SimulateFailureDto): Promise<SimulateFailedPaymentResult> {
    if (!dto.customerId) {
      throw new BadRequestException('customerId is required');
    }
    if (dto.amount === undefined || dto.amount === null || isNaN(Number(dto.amount)) || Number(dto.amount) <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }

    try {
      return await simulateFailedPayment(this.prisma, {
        customerId: dto.customerId,
        amount: Number(dto.amount),
        method: dto.method,
      });
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  async simulateRecovery(interventionId: string): Promise<SimulateRecoveryResult> {
    if (!interventionId) {
      throw new BadRequestException('interventionId is required');
    }

    try {
      return await simulateRecoveryResult(this.prisma, interventionId);
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }
}
