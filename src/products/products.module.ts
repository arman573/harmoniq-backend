import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExplainabilityModule } from '../explainability/explainability.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { Product } from './product.entity';
import { ProductSpec } from './product-spec.entity';
import { ProductTag } from './product-tag.entity';
import { ProductAnalysis } from './product-analysis.entity';
import { ProductAnalysisService } from './product-analysis.service';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [
    ExplainabilityModule,
    IngredientsModule,
    TypeOrmModule.forFeature([
      Product,
      ProductSpec,
      ProductTag,
      ProductAnalysis,
    ]),
  ],
  providers: [ProductsService, ProductAnalysisService],
  controllers: [ProductsController],
})
export class ProductsModule {}
