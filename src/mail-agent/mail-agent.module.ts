import { Module } from '@nestjs/common';
import { MailAgentController } from './mail-agent.controller';
import { MailAgentService } from './mail-agent.service';

@Module({
  controllers: [MailAgentController],
  providers: [MailAgentService],
  exports: [MailAgentService],
})
export class MailAgentModule {}
