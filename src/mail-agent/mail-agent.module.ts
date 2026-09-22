import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailAgentMessage } from './mail-agent-message.entity';
import { MailAgentController } from './mail-agent.controller';
import { MailAgentService } from './mail-agent.service';
import { MailAgentGptHelpService } from './mail-agent-gpt-help.service';
import { MailAgentWorkstyle } from './mail-agent-workstyle.entity';
import { MailAgentWorkstyleService } from './mail-agent-workstyle.service';

@Module({
  imports: [TypeOrmModule.forFeature([MailAgentMessage, MailAgentWorkstyle])],
  controllers: [MailAgentController],
  providers: [MailAgentService, MailAgentGptHelpService, MailAgentWorkstyleService],
  exports: [MailAgentService, MailAgentWorkstyleService],
})
export class MailAgentModule {}
