import { Body, Controller, Get, Post } from '@nestjs/common';
import { MailAgentService } from './mail-agent.service';
import { getConfiguredMailboxes } from './mail-agent.config';
import { MailEnvelope } from './mail-agent.types';

@Controller('mail-agent')
export class MailAgentController {
  constructor(private readonly mailAgentService: MailAgentService) {}

  @Get('health')
  health() {
    return {
      ok: true,
      service: 'harmoniq-mail-agent',
      mode: 'observe',
      outboundEnabled: false,
      humanApprovalRequired: true,
      monitoredMailboxes: getConfiguredMailboxes(),
    };
  }

  @Post('triage')
  triage(@Body() message: MailEnvelope) {
    return this.mailAgentService.triage(message);
  }
}
