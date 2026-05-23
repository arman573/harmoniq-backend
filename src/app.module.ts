import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { Ingredient } from './ingredients/ingredient.entity';
import { IngredientsModule } from './ingredients/ingredients.module';
import { Product } from './products/product.entity';
import { ProductAnalysis } from './products/product-analysis.entity';
import { ProductSpec } from './products/product-spec.entity';
import { ProductTag } from './products/product-tag.entity';
import { ProductsModule } from './products/products.module';
import { Customer } from './tickets/customer.entity';
import { CustomerChatConversation } from './tickets/customer-chat-conversation.entity';
import { CustomerChatInternalNote } from './tickets/customer-chat-internal-note.entity';
import { CustomerChatMessage } from './tickets/customer-chat-message.entity';
import { CustomerEvent } from './tickets/customer-event.entity';
import { CustomerFact } from './tickets/customer-fact.entity';
import { CustomerProfile } from './tickets/customer-profile.entity';
import { Message } from './tickets/message.entity';
import { Ticket } from './tickets/ticket.entity';
import { TicketsModule } from './tickets/tickets.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { TaxonomyCategory } from './taxonomy/taxonomy-category.entity';
import { TaxonomySpec } from './taxonomy/taxonomy-spec.entity';
import { TaxonomyTag } from './taxonomy/taxonomy-tag.entity';
import { TaxonomySuggestion } from './taxonomy/taxonomy-suggestion.entity';
import { TaxonomyModule } from './taxonomy/taxonomy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
        Ingredient,
      ],
      synchronize: true,
    }),
    AuthModule,
    TicketsModule,
    UsersModule,
    TaxonomyModule,
    ProductsModule,
    IngredientsModule,
  ],
})
export class AppModule {}
