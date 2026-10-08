import { IsIn, IsOptional, IsString, IsUUID, Length, ValidateIf } from 'class-validator';
import { BUSINESS_TYPES } from '../catalog.types';

export class CreateCategoryDto {
  @IsString()
  @Length(1, 150)
  name: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined && v !== '' && v !== 'none')
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsIn(BUSINESS_TYPES)
  businessType?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined && v !== '' && v !== 'none')
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsIn(BUSINESS_TYPES)
  businessType?: string;
}

// A category of the vendor's own store: a copy of a Laoji category
// (`templateCategoryId`, where `name` is optional and defaults to Laoji's)
// or one of its own.
export class CreateVendorCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsUUID()
  templateCategoryId?: string;
}

export class UpdateVendorCategoryDto {
  @IsString()
  @Length(1, 150)
  name: string;
}
