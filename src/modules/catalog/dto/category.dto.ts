import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { BUSINESS_TYPES } from '../catalog.types';

export class CreateCategoryDto {
  @IsString()
  @Length(1, 150)
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

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
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsIn(BUSINESS_TYPES)
  businessType?: string;
}

export class CreateVendorCategoryDto {
  @IsString()
  @Length(1, 150)
  name: string;
}
