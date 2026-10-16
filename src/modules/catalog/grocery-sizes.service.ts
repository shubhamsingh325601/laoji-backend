import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, eq, ne } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  platformSettings,
  products,
  vendorProducts,
} from '../../../drizzle/schema';
import type { GrocerySizeInput } from './dto/admin-vendor-item.dto';

// Grocery sizes: an item sold in several sizes (180ml, 900ml…) is one
// vendor-owned product per size sharing `products.variantGroupId`, each with
// its own listing, price and stock. Ordering, stock and vendor allocation never
// learn about groups — a size is just another product — so this feature only
// adds data around them: admins edit a group here, and catalog responses carry
// each product's sibling sizes so apps can show one card with size chips.

export const GROCERY_SIZES_SETTING = 'grocery_sizes_enabled';
const FLAG_TTL_MS = 30 * 1000;

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Product = typeof products.$inferSelect;
type Listing = typeof vendorProducts.$inferSelect;

// A size as the admin panel edits it: one of the item's other sizes at this vendor.
export interface AdminGrocerySize {
  listingId: string;
  productId: string;
  label: string;
  price: number;
  stockQty: number;
  isAvailable: boolean;
}

// A size as customers see it: every size of the item in the result, itself included.
export interface PublicGrocerySize {
  productId: string;
  label: string;
  price: number;
  mrp: number | null;
  inStock: boolean;
}

@Injectable()
export class GrocerySizesService {
  private flag: { value: boolean; at: number } | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  // Off unless an admin turned it on; an unreadable setting counts as off.
  async isEnabled(): Promise<boolean> {
    if (this.flag && Date.now() - this.flag.at < FLAG_TTL_MS)
      return this.flag.value;
    let value = false;
    try {
      const [row] = await this.db
        .select({ value: platformSettings.value })
        .from(platformSettings)
        .where(eq(platformSettings.key, GROCERY_SIZES_SETTING))
        .limit(1);
      value = row?.value === 'true';
    } catch {
      value = false;
    }
    this.flag = { value, at: Date.now() };
    return value;
  }

  async setEnabled(enabled: boolean, adminId?: string) {
    await this.db
      .insert(platformSettings)
      .values({
        key: GROCERY_SIZES_SETTING,
        value: String(enabled),
        description: 'Lets admins sell grocery items in several sizes',
        updatedAt: new Date(),
        updatedBy: adminId || null,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: String(enabled),
          updatedAt: new Date(),
          updatedBy: adminId || null,
        },
      });
    this.flag = { value: enabled, at: Date.now() };
    return { grocerySizes: enabled };
  }

  // Every size needs a name, different from the others and from the item's own
  // unit (case aside). Lets callers reject bad sizes before saving anything.
  assertValidLabels(unit: string, sizes: { label: string }[]) {
    const wanted = sizes.map((s) => s.label.trim());
    if (wanted.some((l) => !l))
      throw new BadRequestException('Every size needs a name, e.g. 500g');
    const labels = [unit, ...wanted].map((l) => l.trim().toLowerCase());
    if (new Set(labels).size !== labels.length) {
      throw new BadRequestException(
        'Each size must have a different name, including the item’s own unit',
      );
    }
  }

  // Makes the item behind `listingId` have exactly these other sizes at this
  // vendor: existing ones (by listingId) are updated, new ones created, missing
  // ones removed. [] ungroups the item. All or nothing.
  async syncSizes(
    vendorId: string,
    listingId: string,
    sizes: GrocerySizeInput[],
  ) {
    const wanted = sizes.map((s) => ({ ...s, label: s.label.trim() }));

    await this.db.transaction(async (tx) => {
      const [listing] = await tx
        .select()
        .from(vendorProducts)
        .where(
          and(
            eq(vendorProducts.id, listingId),
            eq(vendorProducts.vendorId, vendorId),
          ),
        )
        .limit(1);
      if (!listing)
        throw new NotFoundException('Item not found in this vendor catalog');
      let [primary] = await tx
        .select()
        .from(products)
        .where(eq(products.id, listing.productId))
        .limit(1);
      if (!primary) throw new NotFoundException('Product not found');

      this.assertValidLabels(primary.unit, wanted);

      const others = await this.siblingsAt(tx, vendorId, primary, listing.id);

      if (wanted.length === 0) {
        for (const s of others) await this.removeSize(tx, s.listing, s.product);
        if (primary.variantGroupId) {
          await tx
            .update(products)
            .set({ variantGroupId: null, variantLabel: null })
            .where(eq(products.id, primary.id));
        }
        return;
      }

      // A size group is the vendor's own item: a shared Laoji product is copied
      // for this vendor first, and Laoji's stays as it was (same as editing its details).
      if (primary.ownerVendorId !== vendorId) {
        const [copy] = await tx
          .insert(products)
          .values({
            categoryId: primary.categoryId,
            brand: primary.brand,
            name: primary.name,
            description: primary.description,
            unit: primary.unit,
            size: primary.size,
            mrp: primary.mrp,
            wholesalePrice: primary.wholesalePrice,
            sellingPrice: primary.sellingPrice,
            imageUrl: primary.imageUrl,
            attributes: primary.attributes,
            status: 'active',
            ownerVendorId: vendorId,
            templateProductId: primary.id,
          })
          .returning();
        await tx
          .update(vendorProducts)
          .set({ productId: copy.id })
          .where(eq(vendorProducts.id, listing.id));
        primary = copy;
      }

      const groupId = primary.variantGroupId ?? randomUUID();
      await tx
        .update(products)
        .set({ variantGroupId: groupId, variantLabel: primary.unit })
        .where(eq(products.id, primary.id));

      // Sizes share the item's name, category, description and picture.
      const shared = {
        categoryId: primary.categoryId,
        brand: primary.brand,
        name: primary.name,
        description: primary.description,
        imageUrl: primary.imageUrl,
        variantGroupId: groupId,
      };
      const byListing = new Map(others.map((s) => [s.listing.id, s]));
      const kept = new Set<string>();

      for (const size of wanted) {
        const existing = size.listingId
          ? byListing.get(size.listingId)
          : undefined;
        if (size.listingId && !existing) {
          throw new BadRequestException(
            `Size "${size.label}" was changed elsewhere. Reload and try again.`,
          );
        }
        if (existing) {
          kept.add(existing.listing.id);
          await tx
            .update(products)
            .set({ ...shared, unit: size.label, variantLabel: size.label })
            .where(eq(products.id, existing.product.id));
          await tx
            .update(vendorProducts)
            .set({
              price: size.price,
              ...(size.stockQty !== undefined
                ? { stockQty: Math.floor(size.stockQty) }
                : {}),
              ...(size.isAvailable !== undefined
                ? { isAvailable: size.isAvailable }
                : {}),
              updatedAt: new Date(),
            })
            .where(eq(vendorProducts.id, existing.listing.id));
          continue;
        }
        const [created] = await tx
          .insert(products)
          .values({
            ...shared,
            unit: size.label,
            variantLabel: size.label,
            status: 'active',
            ownerVendorId: vendorId,
          })
          .returning();
        await tx.insert(vendorProducts).values({
          vendorId,
          productId: created.id,
          price: size.price,
          stockQty:
            size.stockQty !== undefined
              ? Math.floor(size.stockQty)
              : listing.stockQty,
          isAvailable: size.isAvailable ?? true,
          commissionPct: listing.commissionPct,
          lastRestockedAt: new Date(),
          updatedAt: new Date(),
        });
      }

      for (const s of others) {
        if (!kept.has(s.listing.id))
          await this.removeSize(tx, s.listing, s.product);
      }
    });
  }

  // The item's other sizes at this vendor, for the admin listing rows.
  // `rows` is that vendor's grocery listings, so no extra query is needed.
  adminSizesFor(
    row: { id: string; productId: string; variantGroupId: string | null },
    rows: {
      id: string;
      productId: string;
      variantGroupId: string | null;
      variantLabel: string | null;
      unit: string;
      price: number;
      stockQty: number;
      isAvailable: boolean;
    }[],
  ): AdminGrocerySize[] {
    if (!row.variantGroupId) return [];
    return rows
      .filter((r) => r.variantGroupId === row.variantGroupId && r.id !== row.id)
      .map((r) => ({
        listingId: r.id,
        productId: r.productId,
        label: r.variantLabel || r.unit,
        price: r.price,
        stockQty: r.stockQty,
        isAvailable: r.isAvailable,
      }))
      .sort((a, b) => a.price - b.price);
  }

  // Adds `sizes` to customer-facing products: every size of the same item in
  // this result, cheapest first, itself included. Standalone products get [].
  withPublicSizes<
    T extends {
      id: string;
      variantGroupId?: string | null;
      variantLabel?: string | null;
      unit: string;
      price: number;
      mrp?: number | null;
      inStock: boolean;
    },
  >(items: T[]): (T & { sizes: PublicGrocerySize[] })[] {
    const byGroup = new Map<string, T[]>();
    for (const item of items) {
      if (!item.variantGroupId) continue;
      const list = byGroup.get(item.variantGroupId) ?? [];
      list.push(item);
      byGroup.set(item.variantGroupId, list);
    }
    return items.map((item) => {
      const group = item.variantGroupId
        ? byGroup.get(item.variantGroupId)
        : undefined;
      const sizes =
        group && group.length > 1
          ? group
              .map((g) => ({
                productId: g.id,
                label: g.variantLabel || g.unit,
                price: g.price,
                mrp: g.mrp ?? null,
                inStock: g.inStock,
              }))
              .sort((a, b) => a.price - b.price)
          : [];
      return { ...item, sizes };
    });
  }

  // Ids of the other active products in this product's size group.
  async siblingProductIds(product: {
    id: string;
    variantGroupId?: string | null;
  }): Promise<string[]> {
    if (!product.variantGroupId) return [];
    const rows = await this.db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.variantGroupId, product.variantGroupId),
          ne(products.id, product.id),
          eq(products.status, 'active'),
        ),
      );
    return rows.map((r) => r.id);
  }

  private async siblingsAt(
    tx: Tx,
    vendorId: string,
    primary: Product,
    listingId: string,
  ) {
    if (!primary.variantGroupId) return [];
    const rows = await tx
      .select({ listing: vendorProducts, product: products })
      .from(vendorProducts)
      .innerJoin(products, eq(vendorProducts.productId, products.id))
      .where(
        and(
          eq(vendorProducts.vendorId, vendorId),
          eq(products.variantGroupId, primary.variantGroupId),
          eq(products.ownerVendorId, vendorId),
        ),
      );
    return rows.filter((r) => r.listing.id !== listingId);
  }

  // Stops selling a size. The product row stays (past orders point at it) but
  // is hidden and taken out of the group.
  private async removeSize(tx: Tx, listing: Listing, product: Product) {
    await tx.delete(vendorProducts).where(eq(vendorProducts.id, listing.id));
    await tx
      .update(products)
      .set({ status: 'inactive', variantGroupId: null, variantLabel: null })
      .where(eq(products.id, product.id));
  }
}
