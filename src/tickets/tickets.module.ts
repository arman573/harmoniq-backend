import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './message.entity';
import { Ticket } from './ticket.entity';
import { Customer } from './customer.entity';
import { CustomerEvent } from './customer-event.entity';
import { CustomerFact } from './customer-fact.entity';
import { CustomerProfile } from './customer-profile.entity';
import { TicketsController } from './tickets.controller';
import { CustomersController } from './customers.controller';
import { TicketsService } from './tickets.service';
import { CustomerIntelligenceService } from './customer-intelligence.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      Message,
      Customer,
      CustomerEvent,
      CustomerFact,
      CustomerProfile,
    ]),
  ],
  controllers: [TicketsController, CustomersController],
  providers: [TicketsService, CustomerIntelligenceService],
})
export class TicketsModule {}
