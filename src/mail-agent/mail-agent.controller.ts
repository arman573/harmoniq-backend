import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { getConfiguredMailboxes } from './mail-agent.config';
import { MailAgentService } from './mail-agent.service';
import { MailAgentWorkstyleService } from './mail-agent-workstyle.service';
import { MailEnvelope } from './mail-agent.types';

@Controller('mail-agent')
export class MailAgentController {
  constructor(
    private readonly mailAgentService: MailAgentService,
    private readonly workstyles: MailAgentWorkstyleService,
  ) {}

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

  @Post('gpt-help/preview')
  gptHelpPreview(@Body() body: { instruction?: string }) {
    return this.workstyles.preview(body?.instruction || '');
  }

  @Post('gpt-help/approve')
  gptHelpApprove(@Body() body: {
    instruction?: string;
    preview?: any;
    model?: string;
    approved?: boolean;
  }) {
    return this.workstyles.approve(body);
  }

  @Get('workstyles')
  workstyleList() {
    return this.workstyles.list();
  }

  @Patch('workstyles/:id/disable')
  disableWorkstyle(@Param('id', ParseIntPipe) id: number) {
    return this.workstyles.disable(id);
  }

  @Patch('messages/:id/resolve')
  resolve(@Param('id', ParseIntPipe) id: number) {
    return this.mailAgentService.resolve(id);
  }
}
