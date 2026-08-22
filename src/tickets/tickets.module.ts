import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/customer.entity';
import { CustomersController } from '../customers/customers.controller';
import { CustomersService } from '../customers/customers.service';
import { CustomerEvent } from '../intelligence/customer-event.entity';
import { CustomerFact } from '../intelligence/customer-fact.entity';
import { Product } from '../products/product.entity';
import { TaxonomyTag } from '../taxonomy/taxonomy-tag.entity';
import { AdminCustomerChatController } from './admin-customer-chat.controller';
import { AdminCustomerChatService } from './admin-customer-chat.service';
import { ChatEventsService } from './chat-events.service';
import { ChatNotificationHooksService } from './chat-notification-hooks.service';
import { CustomerChatConversation } from './customer-chat-conversation.entity';
import { CustomerChatInternalNote } from './customer-chat-internal-note.entity';
import { CustomerChatIntentService } from './customer-chat-intent.service';
import { CustomerChatMessage } from './customer-chat-message.entity';
import { CustomerChatPolicyService } from './customer-chat-policy.service';
import { CustomerChatResponseComposerService } from './customer-chat-response-composer.service';
import { CustomerChatService } from './customer-chat.service';
import { CustomerIntelligenceService } from './customer-intelligence.service';
import { CustomerProfile } from './customer-profile.entity';
import { Message } from './message.entity';
import { SupportIntegrationService } from './support-integration.service';
import { Ticket } from './ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      Message,
      Customer,
      CustomerChatConversation,
      CustomerChatInternalNote,
      CustomerChatMessage,
      CustomerEvent,
      CustomerFact,
      CustomerProfile,
      TaxonomyTag,
      Product,
    ]),
  ],
  controllers: [
    TicketsController,
    CustomersController,
    AdminCustomerChatController,
  ],
  providers: [
    TicketsService,
    CustomersService,
    CustomerIntelligenceService,
    AdminCustomerChatService,
    ChatEventsService,
    ChatNotificationHooksService,
    CustomerChatIntentService,
    CustomerChatPolicyService,
    CustomerChatResponseComposerService,
    CustomerChatService,
    SupportIntegrationService,
  ],
})
export class TicketsModule {}
