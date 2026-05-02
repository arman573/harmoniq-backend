import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './message.entity';
import { Ticket } from './ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, Message])],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
