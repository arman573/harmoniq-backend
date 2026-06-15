import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateProductDto } from './create-product.dto';
import { ProductAnalysisService } from './product-analysis.service';
import { ProductsService } from './products.service';

@UseGuards(AuthGuard('jwt'))
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productAnalysisService: ProductAnalysisService,
  ) {}

  @Get()
  getAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.productsService.findOne(Number(id));
  }

  @Post()
  create(@Body() body: CreateProductDto) {
    return this.productsService.create(body);
  }

  @Post(':id/analyze')
  analyze(@Param('id') id: string) {
    return this.productAnalysisService.analyzeProduct(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<CreateProductDto>) {
    return this.productsService.update(Number(id), body);
  }
}
