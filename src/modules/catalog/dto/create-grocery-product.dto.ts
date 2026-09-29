import { IsBoolean, IsInt, IsISO8601, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

// A product the vendor creates from scratch for its own store.
export class CreateGroceryProductDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsString()
  @Length(1, 50)
  unit: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsInt()
  @Min(0)
  stockQty: number;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  offerTag?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  // Expected back-in-stock date ("YYYY-MM-DD", IST) for a product added
  // without stock.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'restockEta must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  restockEta?: string | null;

  // Business-type-specific fields from the add-product form; checked
  // against that form in product-forms.ts#readProductAttributes.
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
