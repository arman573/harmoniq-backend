import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExplainabilityModule } from '../explainability/explainability.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { TaxonomyTag } from '../taxonomy/taxonomy-tag.entity';
import { ProductAnalysis } from './product-analysis.entity';
import { ProductAnalysisService } from './product-analysis.service';
import { Product } from './product.entity';
import { ProductSpec } from './product-spec.entity';
import { ProductTag } from './product-tag.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    ExplainabilityModule,
    IngredientsModule,
    TypeOrmModule.forFeature([
      Product,
      ProductSpec,
      ProductTag,
      ProductAnalysis,
      TaxonomyTag,
    ]),
  ],
  providers: [ProductsService, ProductAnalysisService],
  controllers: [ProductsController],
})
export class ProductsModule {}
