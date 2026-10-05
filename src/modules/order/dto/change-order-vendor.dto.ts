import { IsOptional, IsUUID } from 'class-validator';

export class ChangeOrderVendorDto {
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  restaurantId?: string;
}
