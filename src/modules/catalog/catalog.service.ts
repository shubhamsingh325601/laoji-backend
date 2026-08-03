import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  categories,
  menuCategories,
  menuItemAddons,
  menuItems,
  menuItemVariants,
  productSuggestions,
  products,
  restaurants,
  vendorProducts,
  vendors,
} from '../../../drizzle/schema';
import { haversineKm } from './catalog.types';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import type { CreateProductSuggestionDto } from './dto/product-suggestion.dto';
import type { UpsertVendorProfileDto } from './dto/vendor-profile.dto';
import type { UpdateVendorProductDto, UpsertVendorProductDto } from './dto/vendor-product.dto';
import type { UpdateRestaurantDto } from './dto/restaurant.dto';
import type {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  MenuItemAddonInput,
  MenuItemVariantInput,
  UpdateMenuCategoryDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';
import { NotificationService } from '../notification/notification.service';
import {
  productSuggestionApprovedVendorPush,
  productSuggestionRejectedVendorPush,
} from '../notification/templates/push/product-suggestion';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly notifications: NotificationService,
  ) {}

  // ---------- Vendor profile ----------

  async getVendorByUserId(userId: string) {
    const [row] = await this.db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
    return row ?? null;
  }

  async requireVendor(userId: string) {
    const vendor = await this.getVendorByUserId(userId);
    if (!vendor) throw new NotFoundException('Vendor profile not set up yet');
    return vendor;
  }

  async upsertVendorProfile(userId: string, dto: UpsertVendorProfileDto) {
    const existing = await this.getVendorByUserId(userId);
    if (existing) {
      const [updated] = await this.db
        .update(vendors)
        .set({
          businessName: dto.businessName,
          ownerName: dto.ownerName,
          type: dto.type,
          pickupLat: dto.pickupLat,
          pickupLng: dto.pickupLng,
          ...(dto.radiusKm !== undefined ? { radiusKm: dto.radiusKm } : {}),
        })
        .where(eq(vendors.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await this.db
      .insert(vendors)
      .values({
        userId,
        businessName: dto.businessName,
        ownerName: dto.ownerName,
        type: dto.type,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        ...(dto.radiusKm !== undefined ? { radiusKm: dto.radiusKm } : {}),
      })
      .returning();
    return created;
  }

  async listVendorsBasic() {
    const rows = await this.db.select().from(vendors);
    return rows.map((v) => ({ id: v.id, businessName: v.businessName, type: v.type }));
  }

  async listRestaurantsBasic() {
    const rows = await this.db.select().from(restaurants);
    return rows.map((r) => ({ id: r.id, name: r.name, vendorId: r.vendorId }));
  }

  async listMenuItemsBasic() {
    const rows = await this.db.select().from(menuItems);
    return rows.map((i) => ({ id: i.id, name: i.name }));
  }

  // ---------- Admin: categories ----------

  listCategoriesFlat() {
    return this.db.select().from(categories);
  }

  async listCategoriesTree() {
    const all = await this.listCategoriesFlat();
    const allProducts = await this.db.select().from(products);
    const countByCategory = new Map<string, number>();
    for (const p of allProducts) {
      countByCategory.set(p.categoryId, (countByCategory.get(p.categoryId) ?? 0) + 1);
    }
    const roots = all.filter((c) => !c.parentId);
    return roots.map((root) => ({
      id: root.id,
      name: root.name,
      imageUrl: root.imageUrl,
      subcategories: all
        .filter((c) => c.parentId === root.id)
        .map((sub) => ({ id: sub.id, name: sub.name, productCount: countByCategory.get(sub.id) ?? 0 })),
    }));
  }

  async createCategory(dto: CreateCategoryDto) {
    const [row] = await this.db.insert(categories).values(dto).returning();
    return row;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const [row] = await this.db.update(categories).set(dto).where(eq(categories.id, id)).returning();
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }

  async deleteCategory(id: string) {
    await this.db.delete(categories).where(eq(categories.id, id));
  }

  // ---------- Admin + Vendor: master product catalog ----------

  listProducts(categoryId?: string) {
    return this.db
      .select()
      .from(products)
      .where(categoryId ? eq(products.categoryId, categoryId) : undefined);
  }

  async getProduct(id: string) {
    const [row] = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!row) throw new NotFoundException('Product not found');
    return row;
  }

  async createProduct(dto: CreateProductDto) {
    const [row] = await this.db.insert(products).values(dto).returning();
    return row;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const [row] = await this.db.update(products).set(dto).where(eq(products.id, id)).returning();
    if (!row) throw new NotFoundException('Product not found');
    return row;
  }

  async deleteProduct(id: string) {
    await this.db.delete(products).where(eq(products.id, id));
  }

  // ---------- Vendor: own stock/price/availability ----------

  async listVendorProducts(vendorId: string) {
    const rows = await this.db
      .select({ vendorProduct: vendorProducts, product: products })
      .from(vendorProducts)
      .innerJoin(products, eq(vendorProducts.productId, products.id))
      .where(eq(vendorProducts.vendorId, vendorId));
    return rows.map((r) => ({ ...r.vendorProduct, product: r.product }));
  }

  async upsertVendorProduct(vendorId: string, dto: UpsertVendorProductDto) {
    const [existing] = await this.db
      .select()
      .from(vendorProducts)
      .where(and(eq(vendorProducts.vendorId, vendorId), eq(vendorProducts.productId, dto.productId)))
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(vendorProducts)
        .set({
          price: dto.price,
          stockQty: dto.stockQty,
          isAvailable: dto.isAvailable ?? existing.isAvailable,
          updatedAt: new Date(),
        })
        .where(eq(vendorProducts.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(vendorProducts)
      .values({
        vendorId,
        productId: dto.productId,
        price: dto.price,
        stockQty: dto.stockQty,
        isAvailable: dto.isAvailable ?? true,
      })
      .returning();
    return created;
  }

  private async requireOwnVendorProduct(vendorId: string, id: string) {
    const [row] = await this.db.select().from(vendorProducts).where(eq(vendorProducts.id, id)).limit(1);
    if (!row) throw new NotFoundException('Listing not found');
    if (row.vendorId !== vendorId) throw new ForbiddenException('Not your listing');
    return row;
  }

  async updateVendorProduct(vendorId: string, id: string, dto: UpdateVendorProductDto) {
    await this.requireOwnVendorProduct(vendorId, id);
    const [updated] = await this.db
      .update(vendorProducts)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(vendorProducts.id, id))
      .returning();
    return updated;
  }

  async deleteVendorProduct(vendorId: string, id: string) {
    await this.requireOwnVendorProduct(vendorId, id);
    await this.db.delete(vendorProducts).where(eq(vendorProducts.id, id));
  }

  // ---------- Public: customer browse (grocery) ----------

  /** Vendor ids whose pickup point is within their own configured radius of (lat, lng). */
  private async vendorsInRadius(lat: number, lng: number) {
    const allVendors = await this.db.select().from(vendors);
    return allVendors.filter((v) => haversineKm(lat, lng, v.pickupLat, v.pickupLng) <= v.radiusKm);
  }

  async publicListProducts(lat: number, lng: number, categoryId?: string) {
    const inRadius = await this.vendorsInRadius(lat, lng);
    const vendorIds = inRadius.map((v) => v.id);
    if (vendorIds.length === 0) return [];

    const rows = await this.db
      .select({ vendorProduct: vendorProducts, product: products })
      .from(vendorProducts)
      .innerJoin(products, eq(vendorProducts.productId, products.id))
      .where(
        and(
          inArray(vendorProducts.vendorId, vendorIds),
          eq(vendorProducts.isAvailable, true),
          eq(products.status, 'active'),
          categoryId ? eq(products.categoryId, categoryId) : undefined,
        ),
      );

    return this.aggregateByProduct(rows);
  }

  async publicGetProduct(id: string, lat: number, lng: number) {
    const product = await this.getProduct(id);
    const inRadius = await this.vendorsInRadius(lat, lng);
    const vendorIds = inRadius.map((v) => v.id);

    const rows =
      vendorIds.length === 0
        ? []
        : await this.db
            .select({ vendorProduct: vendorProducts, product: products })
            .from(vendorProducts)
            .innerJoin(products, eq(vendorProducts.productId, products.id))
            .where(
              and(
                eq(vendorProducts.productId, id),
                inArray(vendorProducts.vendorId, vendorIds),
                eq(vendorProducts.isAvailable, true),
              ),
            );

    const [aggregated] = this.aggregateByProduct(rows);
    return {
      ...product,
      price: aggregated?.price ?? null,
      inStock: !!aggregated,
    };
  }

  private aggregateByProduct(rows: { vendorProduct: typeof vendorProducts.$inferSelect; product: typeof products.$inferSelect }[]) {
    const byProduct = new Map<string, { product: typeof products.$inferSelect; price: number; inStock: boolean }>();
    for (const { vendorProduct, product } of rows) {
      const inStock = vendorProduct.stockQty > 0;
      const existing = byProduct.get(product.id);
      if (!existing || (inStock && vendorProduct.price < existing.price)) {
        byProduct.set(product.id, { product, price: vendorProduct.price, inStock: inStock || existing?.inStock === true });
      } else if (inStock) {
        existing.inStock = true;
      }
    }
    return [...byProduct.values()].map(({ product, price, inStock }) => ({ ...product, price, inStock }));
  }

  // ---------- Public: customer browse (restaurants + menu) ----------

  async publicListRestaurants(lat: number, lng: number) {
    const inRadius = await this.vendorsInRadius(lat, lng);
    const vendorIds = inRadius.filter((v) => v.type !== 'grocery').map((v) => v.id);
    if (vendorIds.length === 0) return [];

    return this.db
      .select()
      .from(restaurants)
      .where(and(inArray(restaurants.vendorId, vendorIds), eq(restaurants.isOpen, true)));
  }

  async publicGetRestaurant(id: string) {
    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const cats = await this.db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.restaurantId, id));

    const items = cats.length
      ? await this.db
          .select()
          .from(menuItems)
          .where(
            inArray(
              menuItems.menuCategoryId,
              cats.map((c) => c.id),
            ),
          )
      : [];

    const itemIds = items.map((i) => i.id);
    const addons = itemIds.length
      ? await this.db.select().from(menuItemAddons).where(inArray(menuItemAddons.menuItemId, itemIds))
      : [];
    const variants = itemIds.length
      ? await this.db.select().from(menuItemVariants).where(inArray(menuItemVariants.menuItemId, itemIds))
      : [];

    return {
      ...restaurant,
      menuCategories: cats.map((cat) => ({
        ...cat,
        items: items
          .filter((i) => i.menuCategoryId === cat.id)
          .map((item) => ({
            ...item,
            addons: addons.filter((a) => a.menuItemId === item.id),
            variants: variants.filter((v) => v.menuItemId === item.id),
          })),
      })),
    };
  }

  // ---------- Vendor: own restaurant + menu ----------

  async getOrCreateRestaurant(vendorId: string) {
    const [existing] = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, vendorId)).limit(1);
    if (existing) return existing;

    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.type === 'grocery') {
      throw new ConflictException('Vendor is not registered as a restaurant');
    }

    const [created] = await this.db.insert(restaurants).values({ vendorId, name: vendor.businessName }).returning();
    return created;
  }

  async updateRestaurant(vendorId: string, dto: UpdateRestaurantDto) {
    const restaurant = await this.getOrCreateRestaurant(vendorId);
    const [updated] = await this.db
      .update(restaurants)
      .set(dto)
      .where(eq(restaurants.id, restaurant.id))
      .returning();
    return updated;
  }

  async listMenuCategories(vendorId: string) {
    const restaurant = await this.getOrCreateRestaurant(vendorId);
    return this.db.select().from(menuCategories).where(eq(menuCategories.restaurantId, restaurant.id));
  }

  async createMenuCategory(vendorId: string, dto: CreateMenuCategoryDto) {
    const restaurant = await this.getOrCreateRestaurant(vendorId);
    const [row] = await this.db
      .insert(menuCategories)
      .values({ restaurantId: restaurant.id, name: dto.name, sortOrder: dto.sortOrder ?? 0 })
      .returning();
    return row;
  }

  private async requireOwnMenuCategory(vendorId: string, id: string) {
    const restaurant = await this.getOrCreateRestaurant(vendorId);
    const [row] = await this.db.select().from(menuCategories).where(eq(menuCategories.id, id)).limit(1);
    if (!row || row.restaurantId !== restaurant.id) throw new NotFoundException('Menu category not found');
    return row;
  }

  async updateMenuCategory(vendorId: string, id: string, dto: UpdateMenuCategoryDto) {
    await this.requireOwnMenuCategory(vendorId, id);
    const [updated] = await this.db.update(menuCategories).set(dto).where(eq(menuCategories.id, id)).returning();
    return updated;
  }

  async deleteMenuCategory(vendorId: string, id: string) {
    await this.requireOwnMenuCategory(vendorId, id);
    await this.db.delete(menuCategories).where(eq(menuCategories.id, id));
  }

  async listMenuItems(vendorId: string, menuCategoryId?: string) {
    const restaurant = await this.getOrCreateRestaurant(vendorId);
    const cats = await this.db.select().from(menuCategories).where(eq(menuCategories.restaurantId, restaurant.id));
    const catIds = cats.map((c) => c.id);
    if (catIds.length === 0) return [];

    const items = await this.db
      .select()
      .from(menuItems)
      .where(
        and(
          inArray(menuItems.menuCategoryId, catIds),
          menuCategoryId ? eq(menuItems.menuCategoryId, menuCategoryId) : undefined,
        ),
      );
    const itemIds = items.map((i) => i.id);
    const addons = itemIds.length
      ? await this.db.select().from(menuItemAddons).where(inArray(menuItemAddons.menuItemId, itemIds))
      : [];
    const variants = itemIds.length
      ? await this.db.select().from(menuItemVariants).where(inArray(menuItemVariants.menuItemId, itemIds))
      : [];
    return items.map((item) => ({
      ...item,
      addons: addons.filter((a) => a.menuItemId === item.id),
      variants: variants.filter((v) => v.menuItemId === item.id),
    }));
  }

  async createMenuItem(vendorId: string, dto: CreateMenuItemDto) {
    await this.requireOwnMenuCategory(vendorId, dto.menuCategoryId);
    const [item] = await this.db
      .insert(menuItems)
      .values({
        menuCategoryId: dto.menuCategoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        isVeg: dto.isVeg ?? true,
      })
      .returning();

    const addons = await this.replaceAddons(item.id, dto.addons);
    const variants = await this.replaceVariants(item.id, dto.variants);
    return { ...item, addons, variants };
  }

  private async requireOwnMenuItem(vendorId: string, id: string) {
    const restaurant = await this.getOrCreateRestaurant(vendorId);
    const [row] = await this.db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
    if (!row) throw new NotFoundException('Menu item not found');
    const [cat] = await this.db.select().from(menuCategories).where(eq(menuCategories.id, row.menuCategoryId)).limit(1);
    if (!cat || cat.restaurantId !== restaurant.id) throw new ForbiddenException('Not your menu item');
    return row;
  }

  async updateMenuItem(vendorId: string, id: string, dto: UpdateMenuItemDto) {
    await this.requireOwnMenuItem(vendorId, id);
    const { addons, variants, ...fields } = dto;
    const [updated] = await this.db.update(menuItems).set(fields).where(eq(menuItems.id, id)).returning();
    const finalAddons =
      addons !== undefined
        ? await this.replaceAddons(id, addons)
        : await this.db.select().from(menuItemAddons).where(eq(menuItemAddons.menuItemId, id));
    const finalVariants =
      variants !== undefined
        ? await this.replaceVariants(id, variants)
        : await this.db.select().from(menuItemVariants).where(eq(menuItemVariants.menuItemId, id));
    return { ...updated, addons: finalAddons, variants: finalVariants };
  }

  async deleteMenuItem(vendorId: string, id: string) {
    await this.requireOwnMenuItem(vendorId, id);
    await this.db.delete(menuItems).where(eq(menuItems.id, id));
  }

  private async replaceAddons(menuItemId: string, addons?: MenuItemAddonInput[]) {
    await this.db.delete(menuItemAddons).where(eq(menuItemAddons.menuItemId, menuItemId));
    if (!addons || addons.length === 0) return [];
    return this.db
      .insert(menuItemAddons)
      .values(addons.map((a) => ({ menuItemId, name: a.name, price: a.price, isRequired: a.isRequired ?? false })))
      .returning();
  }

  private async replaceVariants(menuItemId: string, variants?: MenuItemVariantInput[]) {
    await this.db.delete(menuItemVariants).where(eq(menuItemVariants.menuItemId, menuItemId));
    if (!variants || variants.length === 0) return [];
    return this.db
      .insert(menuItemVariants)
      .values(
        variants.map((v) => ({
          menuItemId,
          name: v.name,
          priceDelta: v.priceDelta,
          isDefault: v.isDefault ?? false,
        })),
      )
      .returning();
  }

  // ---------- Vendor + Admin: product suggestions ----------

  async createProductSuggestion(vendorId: string, dto: CreateProductSuggestionDto) {
    const [row] = await this.db
      .insert(productSuggestions)
      .values({
        vendorId,
        name: dto.name,
        categoryId: dto.categoryId,
        unit: dto.unit,
        size: dto.size,
        imageUrl: dto.imageUrl,
      })
      .returning();
    return row;
  }

  listMyProductSuggestions(vendorId: string) {
    return this.db
      .select()
      .from(productSuggestions)
      .where(eq(productSuggestions.vendorId, vendorId))
      .orderBy(desc(productSuggestions.createdAt));
  }

  async listProductSuggestions(status?: 'pending' | 'approved' | 'rejected') {
    const rows = await this.db
      .select({ suggestion: productSuggestions, vendor: vendors, category: categories })
      .from(productSuggestions)
      .innerJoin(vendors, eq(productSuggestions.vendorId, vendors.id))
      .innerJoin(categories, eq(productSuggestions.categoryId, categories.id))
      .where(status ? eq(productSuggestions.status, status) : undefined)
      .orderBy(desc(productSuggestions.createdAt));

    return rows.map(({ suggestion, vendor, category }) => ({
      ...suggestion,
      vendorName: vendor.businessName,
      categoryName: category.name,
    }));
  }

  private async requirePendingSuggestion(id: string) {
    const [row] = await this.db.select().from(productSuggestions).where(eq(productSuggestions.id, id)).limit(1);
    if (!row) throw new NotFoundException('Suggestion not found');
    if (row.status !== 'pending') throw new ConflictException('Suggestion has already been reviewed');
    return row;
  }

  // Reuses `createProduct` (Phase 3's real product-creation path) rather
  // than a second insert — an approved suggestion becomes a genuine,
  // browsable catalog product, not a parallel record that happens to look
  // like one.
  async approveProductSuggestion(adminUserId: string, id: string) {
    const suggestion = await this.requirePendingSuggestion(id);

    const product = await this.createProduct({
      categoryId: suggestion.categoryId,
      name: suggestion.name,
      unit: suggestion.unit,
      size: suggestion.size ?? undefined,
      imageUrl: suggestion.imageUrl ?? undefined,
    });

    const [updated] = await this.db
      .update(productSuggestions)
      .set({ status: 'approved', productId: product.id, reviewedBy: adminUserId, reviewedAt: new Date() })
      .where(eq(productSuggestions.id, id))
      .returning();

    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, suggestion.vendorId)).limit(1);
    if (vendor) {
      this.notifications.notifyPush(
        vendor.userId,
        'product_suggestion_approved',
        productSuggestionApprovedVendorPush(suggestion.name),
      );
    }

    return { ...updated, product };
  }

  async rejectProductSuggestion(adminUserId: string, id: string, reason: string) {
    const suggestion = await this.requirePendingSuggestion(id);

    const [updated] = await this.db
      .update(productSuggestions)
      .set({ status: 'rejected', rejectionReason: reason, reviewedBy: adminUserId, reviewedAt: new Date() })
      .where(eq(productSuggestions.id, id))
      .returning();

    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, suggestion.vendorId)).limit(1);
    if (vendor) {
      this.notifications.notifyPush(
        vendor.userId,
        'product_suggestion_rejected',
        productSuggestionRejectedVendorPush(suggestion.name),
      );
    }

    return updated;
  }
}
