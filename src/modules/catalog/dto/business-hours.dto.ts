import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BusinessHoursDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @IsBoolean()
  isOpen: boolean;

  @IsString()
  @Matches(TIME_RE, { message: 'openTime must be HH:mm' })
  openTime: string;

  @IsString()
  @Matches(TIME_RE, { message: 'closeTime must be HH:mm' })
  closeTime: string;
}

export class UpdateBusinessHoursDto {
  @IsBoolean()
  isOpen: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BusinessHoursDayDto)
  schedule?: BusinessHoursDayDto[];
}
