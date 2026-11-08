import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

// The only tabs the Customer app knows how to filter by. Admin controls whether
// each one shows, what it is called and in which order — not what exists.
export const HOME_TAB_KEYS = ['grocery', 'veg', 'non_veg'] as const;
export type HomeTabKey = (typeof HOME_TAB_KEYS)[number];

export class HomeTabDto {
  @IsIn(HOME_TAB_KEYS)
  key: HomeTabKey;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  label: string;

  @IsBoolean()
  isActive: boolean;
}

// The array order is the display order.
export class UpdateHomeTabsDto {
  @IsArray()
  @ArrayMinSize(HOME_TAB_KEYS.length)
  @ArrayMaxSize(HOME_TAB_KEYS.length)
  @ValidateNested({ each: true })
  @Type(() => HomeTabDto)
  tabs: HomeTabDto[];
}
