import { Controller, Get } from '@nestjs/common';

@Controller()
export class AiArmanCustomerGatewayController {
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'ai-arman-customer-gateway',
      customerWidget: true,
      productionActionsEnabled: false,
    };
  }
}
