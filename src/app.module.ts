import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { IngredientsModule } from './ingredients/ingredients.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'harmoniq',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME ?? 'harmoniq',
      autoLoadEntities: true,
      synchronize: process.env.DB_SYNC !== 'false',
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
