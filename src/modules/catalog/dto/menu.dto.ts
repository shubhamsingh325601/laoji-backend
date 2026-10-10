import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { MEAL_SLOTS } from '../meal-slots';

export class CreateMenuCategoryDto {
  @IsString()
  @Length(1, 150)
  name: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMenuCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class MenuItemAddonInput {
  @IsString()
  @Length(1, 150)
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

// Clients sometimes send numbers as strings ("20") or blank/invalid values.
// Convert what is numeric; treat the rest as not sent so the service can fall
// back to `price` (see CatalogService#replaceVariants).
const toFiniteNumberOrUndefined = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export class MenuItemVariantInput {
  @IsString()
  @Length(1, 150)
  name: string;

  @IsOptional()
  @Transform(toFiniteNumberOrUndefined)
  @IsNumber()
  priceDelta?: number;

  @IsOptional()
  @Transform(toFiniteNumberOrUndefined)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateMenuItemDto {
  @IsUUID()
  menuCategoryId: string;

  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  // Meal slots the item is served in; omitted or [] = all day.
  @IsOptional()
  @IsArray()
  @IsIn(MEAL_SLOTS, { each: true })
  mealSlots?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemAddonInput)
  addons?: MenuItemAddonInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemVariantInput)
  variants?: MenuItemVariantInput[];
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsUUID()
  menuCategoryId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  // [] switches the item back to all day; omitted leaves it unchanged.
  @IsOptional()
  @IsArray()
  @IsIn(MEAL_SLOTS, { each: true })
  mealSlots?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemAddonInput)
  addons?: MenuItemAddonInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemVariantInput)
  variants?: MenuItemVariantInput[];
}
