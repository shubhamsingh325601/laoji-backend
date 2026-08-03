import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateProductSuggestionDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsUUID()
  categoryId: string;

  @IsString()
  @Length(1, 50)
  unit: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class RejectProductSuggestionDto {
  @IsString()
  @Length(1, 500)
  reason: string;
}
