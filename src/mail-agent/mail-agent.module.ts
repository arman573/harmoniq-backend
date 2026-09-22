import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailAgentMessage } from './mail-agent-message.entity';
import { MailAgentController } from './mail-agent.controller';
import { MailAgentService } from './mail-agent.service';

@Module({
  imports: [TypeOrmModule.forFeature([MailAgentMessage])],
  controllers: [MailAgentController],
  providers: [MailAgentService],
  exports: [MailAgentService],
})
export class MailAgentModule {}
