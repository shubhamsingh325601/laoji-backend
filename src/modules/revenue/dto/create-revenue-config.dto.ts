import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export const REVENUE_CONFIG_SCOPES = ['global', 'category', 'vendor'] as const;

export class CreateRevenueConfigDto {
  @IsIn(REVENUE_CONFIG_SCOPES)
  scope: (typeof REVENUE_CONFIG_SCOPES)[number];

  @ValidateIf((o) => o.scope !== 'global')
  @IsUUID()
  scopeRefId?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  commissionPct: number;

  @IsNumber()
  @Min(0)
  deliveryFeeFlat: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  codThreshold?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  effectiveFrom: string;
}
