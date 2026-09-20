import { IsBoolean, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpsertDeliveryPartnerDto {
  @IsString()
  @Length(1, 30)
  vehicleType: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  vehicleModel?: string;
}

export class SetOnlineDto {
  @IsBoolean()
  isOnline: boolean;
}

export class UpdateLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}
