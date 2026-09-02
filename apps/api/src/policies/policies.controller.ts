import { Controller, Get, Put, Body, Param, Query } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  async getPolicies(@Query('merchantId') merchantId?: string) {
    return await this.policiesService.getPolicies(merchantId);
  }

  @Get('evaluate/:paymentId')
  async evaluateForPayment(@Param('paymentId') paymentId: string) {
    return await this.policiesService.evaluateForPayment(paymentId);
  }

  @Put(':merchantId')
  async updatePolicyWithParam(
    @Param('merchantId') merchantId: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return await this.policiesService.updatePolicy(merchantId, dto);
  }

  @Put()
  async updatePolicyWithBody(@Body() dto: UpdatePolicyDto) {
    const merchantId = dto.merchantId;
    return await this.policiesService.updatePolicy(merchantId!, dto);
  }
}
