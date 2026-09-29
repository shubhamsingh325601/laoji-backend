import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Product details a vendor may send along with its listing terms. On a Laoji
// product they go to the vendor's own copy of it, never to Laoji's (see
// CatalogService#productForListing). Blank optional text clears the field.
export class VendorProductDetailsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  size?: string;

  // null clears it.
  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number | null;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Business-type fields from the add-product form (product-forms.ts).
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

// Adds a product to the vendor's store, or updates its listing when the store
// already has one for it (or for its own copy of it).
export class UpsertVendorProductDto extends VendorProductDetailsDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsInt()
  @Min(0)
  stockQty: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  offerTag?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  // Expected back-in-stock date ("YYYY-MM-DD", IST); null clears it.
  @IsOptional()
  @Matches(DATE_RE, { message: 'restockEta must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  restockEta?: string | null;
}

export class UpdateVendorProductDto extends VendorProductDetailsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  offerTag?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @Matches(DATE_RE, { message: 'restockEta must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  restockEta?: string | null;
}

export class RestockVendorProductDto {
  // Units received, added on top of the current stock.
  @IsInt()
  @Min(1)
  @Max(100_000)
  qty: number;
}

export class CreateVendorCustomProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsUUID()
  categoryId: string;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateVendorCustomProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

