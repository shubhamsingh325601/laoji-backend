import { BadRequestException } from '@nestjs/common';

// Laoji's categories and products (owner null) are templates: a vendor copies
// them into its own store and changes only its copy. These helpers answer
// "where does this show" and "what did the vendor change" for that model.

interface CategoryRef {
  id: string;
  ownerVendorId: string | null;
  templateCategoryId: string | null;
}

/** A vendor's own copy of each Laoji category it has one of, keyed by the Laoji category's id. */
export function ownCopiesByTemplate<C extends CategoryRef>(categories: C[], vendorId: string): Map<string, C> {
  const copies = new Map<string, C>();
  for (const c of categories) {
    if (c.ownerVendorId === vendorId && c.templateCategoryId) copies.set(c.templateCategoryId, c);
  }
  return copies;
}

/**
 * The category a product shows under in a vendor's store: the store's own
 * copy of the product's Laoji category when it has one, else the category
 * itself.
 */
export function shopCategoryId(categoryId: string, copies: Map<string, { id: string }>): string {
  return copies.get(categoryId)?.id ?? categoryId;
}

/**
 * The category customers browse a product under (and revenue rules are set
 * on): a vendor's copy of a Laoji category counts as the Laoji category.
 * A vendor's category of its own has no Laoji one and stands for itself.
 */
export function laojiCategoryId(categoryId: string, byId: Map<string, CategoryRef>): string {
  const category = byId.get(categoryId);
  return category?.ownerVendorId && category.templateCategoryId ? category.templateCategoryId : categoryId;
}

export type ProductAttributes = Record<string, string | number | boolean>;

/**
 * Form details as stored: empty values and unset toggles (false) dropped,
 * keys sorted, null when nothing is left — so a form sent back unchanged
 * compares equal to what it was filled from.
 */
export function normalizeAttributes(attributes: Record<string, unknown> | null | undefined): ProductAttributes | null {
  if (!attributes) return null;
  const entries = Object.entries(attributes)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)
    .sort(([a], [b]) => a.localeCompare(b)) as [string, string | number | boolean][];
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export interface ProductDetailColumns {
  name: string;
  brand: string | null;
  categoryId: string;
  unit: string;
  size: string | null;
  mrp: number | null;
  imageUrl: string | null;
  description: string | null;
  attributes: ProductAttributes | null;
}

export interface ProductDetailInput {
  name?: string;
  brand?: string;
  categoryId?: string;
  unit?: string;
  size?: string;
  mrp?: number | null;
  imageUrl?: string;
  description?: string;
  attributes?: ProductAttributes | null;
}

const optionalText = (value: string | null | undefined) => (value ?? '').trim() || null;

/**
 * The product columns `input` actually changes. Fields left out are kept and
 * blank optional text clears. App builds resend every field on each edit, so
 * only a real difference counts — that is what decides whether a vendor
 * editing a Laoji product needs its own copy. `sameCategory` says whether a
 * category id is where the product already is.
 */
export function productDetailChanges(
  product: ProductDetailColumns,
  input: ProductDetailInput,
  sameCategory: (categoryId: string) => boolean,
): Partial<ProductDetailColumns> {
  const changes: Partial<ProductDetailColumns> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Product name is required');
    if (name !== product.name.trim()) changes.name = name;
  }
  if (input.unit !== undefined) {
    const unit = input.unit.trim();
    if (!unit) throw new BadRequestException('Unit is required');
    if (unit !== product.unit.trim()) changes.unit = unit;
  }
  for (const key of ['brand', 'size', 'imageUrl', 'description'] as const) {
    if (input[key] === undefined) continue;
    const value = optionalText(input[key]);
    if (value !== optionalText(product[key])) changes[key] = value;
  }
  if (input.mrp !== undefined && (input.mrp ?? null) !== product.mrp) changes.mrp = input.mrp ?? null;
  if (input.categoryId !== undefined && !sameCategory(input.categoryId)) changes.categoryId = input.categoryId;
  if (input.attributes !== undefined) {
    const attributes = normalizeAttributes(input.attributes);
    if (JSON.stringify(attributes) !== JSON.stringify(normalizeAttributes(product.attributes))) {
      changes.attributes = attributes;
    }
  }
  return changes;
}
