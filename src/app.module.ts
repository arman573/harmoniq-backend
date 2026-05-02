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
import { TaxonomyCategory } from './taxonomy/taxonomy-category.entity';
import { TaxonomySpec } from './taxonomy/taxonomy-spec.entity';
import { TaxonomyTag } from './taxonomy/taxonomy-tag.entity';
import { TaxonomySuggestion } from './taxonomy/taxonomy-suggestion.entity';

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
        TaxonomyCategory,
        TaxonomySpec,
        TaxonomyTag,
        TaxonomySuggestion,
      ],
      synchronize: true,
    }),
    AuthModule,
    TicketsModule,
    UsersModule,
  ],
})
export class AppModule {}
