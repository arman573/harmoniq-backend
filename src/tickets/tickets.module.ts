import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/customer.entity';
import { CustomersController } from '../customers/customers.controller';
import { CustomersService } from '../customers/customers.service';
import { CustomerEvent } from '../intelligence/customer-event.entity';
import { CustomerFact } from '../intelligence/customer-fact.entity';
import { Product } from '../products/product.entity';
import { TaxonomyTag } from '../taxonomy/taxonomy-tag.entity';
import { CustomerIntelligenceService } from './customer-intelligence.service';
import { CustomerProfile } from './customer-profile.entity';
import { Message } from './message.entity';
import { Ticket } from './ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      Message,
      Customer,
      CustomerEvent,
      CustomerFact,
      CustomerProfile,
      TaxonomyTag,
      Product,
    ]),
  ],
  controllers: [TicketsController, CustomersController],
  providers: [TicketsService, CustomersService, CustomerIntelligenceService],
})
export class TicketsModule {}
