import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxonomyCategory } from './taxonomy-category.entity';
import { TaxonomyTag } from './taxonomy-tag.entity';
import { TaxonomySpec } from './taxonomy-spec.entity';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxonomyCategory,
      TaxonomyTag,
      TaxonomySpec,
    ]),
  ],
  controllers: [TaxonomyController],
  providers: [TaxonomyService],
})
export class TaxonomyModule {}
