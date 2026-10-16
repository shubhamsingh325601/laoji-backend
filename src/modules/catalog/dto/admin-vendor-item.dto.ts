import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { MenuItemAddonInput, MenuItemVariantInput } from './menu.dto';

export class BulkDeleteAdminVendorItemsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  itemIds: string[];
}

// One extra size of a grocery item (see GrocerySizesService). The item being
// saved is itself one size, labelled by its `unit`; `sizes` lists the others.
export class GrocerySizeInput {
  // An existing size's listing id; omit to add a new size.
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsString()
  @Length(1, 50)
  label: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class CreateAdminVendorItemDto {
  @IsOptional()
  @IsIn(['grocery', 'menu_item'])
  itemType?: 'grocery' | 'menu_item';

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
  @IsNumber()
  @Min(0)
  wholesalePrice?: number;

  @IsOptional()
  @IsString()
  unit?: string;
  
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionPct?: number;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsBoolean()
  isCustomisable?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemVariantInput)
  variants?: MenuItemVariantInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemAddonInput)
  addons?: MenuItemAddonInput[];

  // Grocery only, and only while grocery sizes are switched on.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GrocerySizeInput)
  sizes?: GrocerySizeInput[];
}

export class UpdateAdminVendorItemDto {
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
  @IsNumber()
  @Min(0)
  wholesalePrice?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionPct?: number;

  @IsOptional()
  @IsBoolean()
  isCustomisable?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemVariantInput)
  variants?: MenuItemVariantInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemAddonInput)
  addons?: MenuItemAddonInput[];

  // Grocery only, and only while grocery sizes are switched on. Omitted =
  // sizes untouched; [] = remove every extra size.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GrocerySizeInput)
  sizes?: GrocerySizeInput[];
}
