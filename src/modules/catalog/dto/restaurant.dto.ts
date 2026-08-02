import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  cuisineTags?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;
}
