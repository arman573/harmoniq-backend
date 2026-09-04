import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiArmanModule } from './ai-arman/ai-arman.module';
import { AuthModule } from './auth/auth.module';
import { Customer } from './customers/customer.entity';
import { CustomerEvent } from './intelligence/customer-event.entity';
import { CustomerFact } from './intelligence/customer-fact.entity';
import { Message } from './tickets/message.entity';
import { Ticket } from './tickets/ticket.entity';
import { TicketsModule } from './tickets/tickets.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'harmoniq',
      password: 'password',
      database: 'harmoniq',
      entities: [User, Ticket, Message, Customer, CustomerEvent, CustomerFact],
      synchronize: true,
    }),
    AuthModule,
    TicketsModule,
    UsersModule,
    AiArmanModule,
  ],
})
export class AppModule {}
