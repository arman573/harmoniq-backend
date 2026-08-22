import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { Customer } from './customers/customer.entity';
import { CustomerEvent } from './intelligence/customer-event.entity';
import { CustomerFact } from './intelligence/customer-fact.entity';
import { ProductAnalysis } from './products/product-analysis.entity';
import { ProductSpec } from './products/product-spec.entity';
import { ProductTag } from './products/product-tag.entity';
import { Product } from './products/product.entity';
import { ProductsModule } from './products/products.module';
import { TaxonomyCategory } from './taxonomy/taxonomy-category.entity';
import { TaxonomySpec } from './taxonomy/taxonomy-spec.entity';
import { TaxonomySuggestion } from './taxonomy/taxonomy-suggestion.entity';
import { TaxonomyTag } from './taxonomy/taxonomy-tag.entity';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { CustomerChatConversation } from './tickets/customer-chat-conversation.entity';
import { CustomerChatInternalNote } from './tickets/customer-chat-internal-note.entity';
import { CustomerChatMessage } from './tickets/customer-chat-message.entity';
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
        CustomerChatConversation,
        CustomerChatInternalNote,
        CustomerChatMessage,
        CustomerProfile,
        CustomerFact,
        CustomerEvent,
        TaxonomyCategory,
        TaxonomySpec,
        TaxonomyTag,
        TaxonomySuggestion,
        Product,
        ProductSpec,
        ProductTag,
        ProductAnalysis,
      ],
      synchronize: true,
    }),
    AuthModule,
    TicketsModule,
    UsersModule,
    TaxonomyModule,
    ProductsModule,
  ],
})
export class AppModule {}
