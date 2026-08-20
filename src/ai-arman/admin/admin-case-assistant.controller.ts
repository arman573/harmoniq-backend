import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AiArmanAdminCaseAssistantConfig } from './admin-case-assistant.config';
import { AiArmanAdminCaseAssistantOrchestratorService } from './admin-case-assistant-orchestrator.service';
import { AiArmanAdminCaseAssistantService } from './admin-case-assistant.service';
import { AiArmanAdminCaseAssistantV2PageService } from './admin-case-assistant-v2-page.service';

@Controller('ai-arman/internal/admin-assistant')
export class AiArmanAdminCaseAssistantController {
  constructor(
    private readonly config: AiArmanAdminCaseAssistantConfig,
    private readonly assistant: AiArmanAdminCaseAssistantOrchestratorService,
    private readonly learning: AiArmanAdminCaseAssistantService,
    private readonly page: AiArmanAdminCaseAssistantV2PageService,
  ) {}

  @Get()
  render(@Res() res: Response) {
    const config = this.config.read();
    if (!config.assistantEnabled) return res.status(404).send('Not Found');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.type('html').send(this.page.render({ learningEnabled: config.learningEnabled }));
  }

  @Post('assist')
  async assist(@Body() body: unknown) {
    return this.assistant.assist(body);
  }

  @Post('learn')
  async learn(@Body() body: unknown) {
    return this.learning.approveLearning(body);
  }
}
