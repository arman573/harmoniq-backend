import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { Message } from './tickets/message.entity';
import { Ticket } from './tickets/ticket.entity';
import { TicketsModule } from './tickets/tickets.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { Customer } from './customers/customer.entity';
import { CustomerEvent } from './intelligence/customer-event.entity';
import { CustomerFact } from './intelligence/customer-fact.entity';
import { MailAgentModule } from './mail-agent/mail-agent.module';
import { MailAgentMessage } from './mail-agent/mail-agent-message.entity';
import { MailAgentWorkstyle } from './mail-agent/mail-agent-workstyle.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'harmoniq',
      password: 'password',
      database: 'harmoniq',
      entities: [User, Ticket, Message, Customer, CustomerEvent, CustomerFact, MailAgentMessage, MailAgentWorkstyle],
      synchronize: true,
    }),
    AuthModule,
    TicketsModule,
    UsersModule,
    MailAgentModule,
  ],
})
export class AppModule {}
