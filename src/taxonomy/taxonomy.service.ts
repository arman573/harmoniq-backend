import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxonomyCategory } from './taxonomy-category.entity';
import { TaxonomyTag } from './taxonomy-tag.entity';
import { TaxonomySpec } from './taxonomy-spec.entity';
import { ImportTaxonomyDto } from './import-taxonomy.dto';

@Injectable()
export class TaxonomyService {
  constructor(
    @InjectRepository(TaxonomyCategory)
    private categoryRepo: Repository<TaxonomyCategory>,
    @InjectRepository(TaxonomyTag)
    private tagRepo: Repository<TaxonomyTag>,
    @InjectRepository(TaxonomySpec)
    private specRepo: Repository<TaxonomySpec>,
  ) {}

  getCategories() {
    return this.categoryRepo.find();
  }

  getTags() {
    return this.tagRepo.find();
  }

  getSpecs() {
    return this.specRepo.find();
  }

  async import(data: ImportTaxonomyDto) {
    if (data.categories?.length) {
      for (const cat of data.categories) {
        const entity = this.categoryRepo.create({
          ...cat,
          depth: cat.path.split('>').length,
        });
        await this.categoryRepo.save(entity);
      }
    }

    if (data.tags?.length) {
      for (const tag of data.tags) {
        const entity = this.tagRepo.create(tag);
        await this.tagRepo.save(entity);
      }
    }

    if (data.specs?.length) {
      for (const spec of data.specs) {
        const entity = this.specRepo.create(spec);
        await this.specRepo.save(entity);
      }
    }

    return { success: true };
  }
}
