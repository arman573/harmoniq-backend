import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
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
      entities: [User, Ticket, Message],
      synchronize: true,
    }),
    AuthModule,
    TicketsModule,
    UsersModule,
  ],
})
export class AppModule {}
