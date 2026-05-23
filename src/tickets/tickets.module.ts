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
import { AdminCustomerChatController } from './admin-customer-chat.controller';
import { AdminCustomerChatService } from './admin-customer-chat.service';
import { ChatEventsService } from './chat-events.service';
import { ChatNotificationHooksService } from './chat-notification-hooks.service';
import { TicketsService } from './tickets.service';
import { CustomerIntelligenceService } from './customer-intelligence.service';
import { CustomerChatConversation } from './customer-chat-conversation.entity';
import { CustomerChatInternalNote } from './customer-chat-internal-note.entity';
import { CustomerChatIntentService } from './customer-chat-intent.service';
import { CustomerChatMessage } from './customer-chat-message.entity';
import { CustomerChatPolicyService } from './customer-chat-policy.service';
import { CustomerChatResponseComposerService } from './customer-chat-response-composer.service';
import { CustomerChatService } from './customer-chat.service';
import { SupportIntegrationService } from './support-integration.service';
import { TaxonomyTag } from '../taxonomy/taxonomy-tag.entity';
import { Product } from '../products/product.entity';
import { ExplainabilityModule } from '../explainability/explainability.module';

@Module({
  imports: [
    ExplainabilityModule,
    TypeOrmModule.forFeature([
      Ticket,
      Message,
      Customer,
      CustomerEvent,
      CustomerFact,
      CustomerProfile,
      CustomerChatConversation,
      CustomerChatInternalNote,
      CustomerChatMessage,
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
    AdminCustomerChatService,
    ChatEventsService,
    ChatNotificationHooksService,
    TicketsService,
    CustomerIntelligenceService,
    CustomerChatIntentService,
    CustomerChatPolicyService,
    CustomerChatResponseComposerService,
    CustomerChatService,
    SupportIntegrationService,
  ],
})
export class TicketsModule {}
