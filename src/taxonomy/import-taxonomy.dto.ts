import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportCategoryDto {
  @IsString()
  name!: string;

  @IsString()
  path!: string;

  @IsString()
  @IsOptional()
  parentPath?: string;

  @IsString()
  @IsOptional()
  source?: string;
}

export class ImportTagDto {
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

  @IsArray()
  @IsOptional()
  synonyms?: string[];

  @IsString()
  @IsOptional()
  source?: string;
}

export class ImportSpecDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  normalizedKey?: string;

  @IsString()
  @IsOptional()
  sourceColumn?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsArray()
  @IsOptional()
  allowedValues?: string[];

  @IsString()
  @IsOptional()
  source?: string;
}

export class ImportTaxonomyDto {
  @ValidateNested({ each: true })
  @Type(() => ImportCategoryDto)
  @IsArray()
  @IsOptional()
  categories?: ImportCategoryDto[];

  @ValidateNested({ each: true })
  @Type(() => ImportTagDto)
  @IsArray()
  @IsOptional()
  tags?: ImportTagDto[];

  @ValidateNested({ each: true })
  @Type(() => ImportSpecDto)
  @IsArray()
  @IsOptional()
  specs?: ImportSpecDto[];
}
