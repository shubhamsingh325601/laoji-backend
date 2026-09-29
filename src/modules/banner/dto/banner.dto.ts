import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

// home = top carousel, promo = the offer card lower on the home screen,
// order = order tracking screen.
export const BANNER_PLACEMENTS = ['home', 'promo', 'order'] as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];

export class CreateBannerDto {
  @IsString()
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string | null;

  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  imageUrl: string;

  // In-app route, e.g. "/category/<id>".
  @IsOptional()
  @IsString()
  @MaxLength(300)
  link?: string | null;

  @IsOptional()
  @IsIn(BANNER_PLACEMENTS)
  placement?: BannerPlacement;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  link?: string | null;

  @IsOptional()
  @IsIn(BANNER_PLACEMENTS)
  placement?: BannerPlacement;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}
