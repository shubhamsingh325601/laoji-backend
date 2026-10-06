import { IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestVendorWithdrawalDto {
  // Left out = withdraw the whole available balance (older app builds send no body).
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;
}

export class ApproveWithdrawalDto {
  // UTR / UPI transaction id of the manual transfer, for the record.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  payoutReference?: string;
}

export class RejectWithdrawalDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'Please give the vendor a reason for rejecting this request' })
  @MaxLength(500)
  reason: string;
}
