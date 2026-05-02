import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TaxonomyService } from './taxonomy.service';
import { ImportTaxonomyDto } from './import-taxonomy.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('categories')
  getCategories() {
    return this.taxonomyService.getCategories();
  }

  @Get('tags')
  getTags() {
    return this.taxonomyService.getTags();
  }

  @Get('specs')
  getSpecs() {
    return this.taxonomyService.getSpecs();
  }

  @Post('import')
  import(@Body() body: ImportTaxonomyDto) {
    return this.taxonomyService.import(body);
  }
}
