import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { ProductSpec } from './product-spec.entity';
import { ProductTag } from './product-tag.entity';
import { ProductAnalysis } from './product-analysis.entity';
import { CreateProductDto } from './create-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductSpec)
    private readonly specRepo: Repository<ProductSpec>,
    @InjectRepository(ProductTag)
    private readonly tagRepo: Repository<ProductTag>,
    @InjectRepository(ProductAnalysis)
    private readonly analysisRepo: Repository<ProductAnalysis>,
  ) {}

  async create(dto: CreateProductDto) {
    const product = this.productRepo.create(dto);
    const saved = await this.productRepo.save(product);

    if (dto.specs?.length) {
      for (const spec of dto.specs) {
        await this.specRepo.save(
          this.specRepo.create({ ...spec, product: saved }),
        );
      }
    }

    if (dto.tags?.length) {
      for (const tag of dto.tags) {
        await this.tagRepo.save(
          this.tagRepo.create({ ...tag, product: saved }),
        );
      }
    }

    if (dto.analyses?.length) {
      for (const analysis of dto.analyses) {
        await this.analysisRepo.save(
          this.analysisRepo.create({
            status: analysis.status || 'completed',
            analysisSource: analysis.analysisSource || 'manual',
            rawAnalysis: analysis.rawAnalysis,
            product: saved,
          }),
        );
      }
    }

    return this.findOne(saved.id);
  }

  findAll() {
    return this.productRepo.find({
      relations: { specs: true, tags: true, analyses: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: { specs: true, tags: true, analyses: true },
    });

    if (!product) throw new NotFoundException();
    return product;
  }

  async update(id: number, dto: Partial<CreateProductDto>) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException();

    Object.assign(product, dto);
    await this.productRepo.save(product);

    return this.findOne(id);
  }
}
