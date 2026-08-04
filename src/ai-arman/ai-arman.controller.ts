import { Controller, Get } from '@nestjs/common';
import { AiArmanService } from './ai-arman.service';

@Controller('ai-arman')
export class AiArmanController {
  constructor(private readonly aiArmanService: AiArmanService) {}

  @Get('foundation')
  getFoundationStatus() {
    return this.aiArmanService.getFoundationStatus();
  }
}
