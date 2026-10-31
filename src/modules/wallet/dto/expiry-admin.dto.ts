import { IsInt, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class RestoreScratchCardDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustScratchCardExpiryDto {
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RestoreWalletCreditDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustWalletCreditExpiryDto {
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateExpirySettingsDto {
  @IsInt()
  @Min(1)
  @Max(365)
  scratchCardExpiryDays: number;

  @IsInt()
  @Min(1)
  @Max(365)
  walletAmountExpiryDays: number;
}
