import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { getConfiguredMailboxes } from './mail-agent.config';
import { MailAgentService } from './mail-agent.service';
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

  @Post('ingest')
  ingest(@Body() message: MailEnvelope) {
    return this.mailAgentService.ingest(message);
  }

  @Get('attention')
  attention() {
    return this.mailAgentService.getAttentionQueue();
  }

  @Patch('messages/:id/acknowledge')
  acknowledge(@Param('id', ParseIntPipe) id: number) {
    return this.mailAgentService.acknowledge(id);
  }

  @Patch('messages/:id/resolve')
  resolve(@Param('id', ParseIntPipe) id: number) {
    return this.mailAgentService.resolve(id);
  }
}
