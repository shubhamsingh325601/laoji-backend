import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { ADMIN_ORDER_STATUS_FILTERS, type AdminOrderStatusFilter } from '../admin-order-filters';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class AdminOrderListQueryDto {
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

  // Order code (start of the id), customer name/phone, vendor/restaurant name
  // or delivery partner phone.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(ADMIN_ORDER_STATUS_FILTERS)
  status?: AdminOrderStatusFilter;

  @IsOptional()
  @IsIn(['grocery', 'food'])
  type?: 'grocery' | 'food';

  // A vendor id (grocery orders) or a restaurant id (food orders).
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  paymentStatus?: string;

  @IsOptional()
  @Matches(DAY)
  from?: string;

  @IsOptional()
  @Matches(DAY)
  to?: string;
}
