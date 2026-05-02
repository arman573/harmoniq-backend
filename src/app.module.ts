import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { Customer } from './tickets/customer.entity';
import { CustomerEvent } from './tickets/customer-event.entity';
import { CustomerFact } from './tickets/customer-fact.entity';
import { CustomerProfile } from './tickets/customer-profile.entity';
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
      entities: [
        User,
        Ticket,
        Message,
        Customer,
        CustomerProfile,
        CustomerFact,
        CustomerEvent,
      ],
      synchronize: true,
    }),
    AuthModule,
    TicketsModule,
    UsersModule,
  ],
})
export class AppModule {}
