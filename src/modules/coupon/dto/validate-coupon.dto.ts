import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ValidateCouponDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(0)
  subtotal: number;

  // Accepted for older app builds but ignored; the caller is taken from the
  // verified access token.
  @IsOptional()
  @IsString()
  userId?: string;
}
