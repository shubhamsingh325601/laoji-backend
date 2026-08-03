import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class RateFoodOrderDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  comment?: string;
}
