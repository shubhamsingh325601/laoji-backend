import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdminUserListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn(['all', 'customer', 'vendor', 'delivery_partner', 'admin'])
  role?: string;

  // Matches phone, email or name anywhere in the value.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
