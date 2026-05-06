import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductSpecDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsString()
  @IsOptional()
  normalizedKey?: string;

  @IsString()
  @IsOptional()
  source?: string;
}

export class CreateProductTagDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  normalizedKey?: string;

  @IsString()
  @IsOptional()
  sourceCategory?: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsString()
  @IsOptional()
  kind?: string;
}

export class CreateProductAnalysisDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  analysisSource?: string;

  @IsString()
  @IsOptional()
  sourceHash?: string;

  @IsString()
  @IsOptional()
  inciHash?: string;

  @IsString()
  @IsOptional()
  metadataHash?: string;

  @IsNumber()
  @IsOptional()
  confidence?: number;

  @IsArray()
  @IsOptional()
  suitableFor?: string[];

  @IsArray()
  @IsOptional()
  notSuitableFor?: string[];

  @IsArray()
  @IsOptional()
  warnings?: string[];

  @IsArray()
  @IsOptional()
  matchedConcepts?: string[];

  @IsObject()
  @IsOptional()
  scores?: Record<string, number>;

  @IsArray()
  @IsOptional()
  ingredients?: string[];

  @IsObject()
  @IsOptional()
  rawAnalysis?: Record<string, unknown>;
}

export class CreateProductDto {
  @IsString()
  @IsOptional()
  externalId?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  articleNumber?: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  categoryName?: string;

  @IsString()
  @IsOptional()
  categoryPath?: string;

  @IsString()
  @IsOptional()
  mainCategory?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsOptional()
  quantity?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isDiscontinued?: boolean;

  @IsString()
  @IsOptional()
  source?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductSpecDto)
  @IsOptional()
  specs?: CreateProductSpecDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductTagDto)
  @IsOptional()
  tags?: CreateProductTagDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAnalysisDto)
  @IsOptional()
  analyses?: CreateProductAnalysisDto[];
}
