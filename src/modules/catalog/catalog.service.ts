import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  authTokens,
  categories,
  foodOrderRatings,
  foodOrders,
  groceryOrderItems,
  groceryOrders,
  menuCategories,
  menuItemAddons,
  menuItems,
  menuItemVariants,
  productSuggestions,
  products,
  restaurants,
  users,
  vendorProducts,
  vendors,
} from '../../../drizzle/schema';
import {
  BUSINESS_TYPE_ROOT_CATEGORY,
  categoryBusinessType,
  haversineKm,
  isCategoryVisibleTo,
  isVendorOpenNow,
} from './catalog.types';
import { productFormFor, readProductAttributes } from './product-forms';
import type { UpdateBusinessHoursDto } from './dto/business-hours.dto';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import type { CreateProductSuggestionDto } from './dto/product-suggestion.dto';
import type { CreateAdminVendorDto, UpdateAdminVendorDto } from './dto/admin-vendor.dto';
import type { UpsertVendorProfileDto } from './dto/vendor-profile.dto';
import type {
  CreateVendorCustomProductDto,
  UpdateVendorCustomProductDto,
  UpdateVendorProductDto,
  UpsertVendorProductDto,
} from './dto/vendor-product.dto';
import type { CreateGroceryProductDto } from './dto/create-grocery-product.dto';
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
    if (!row) return null;
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    // Dynamic rating calculation from real food order reviews / restaurant data
    const [rest] = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, row.id)).limit(1);
    let ratingAvg = 4.8;
    let ratingCount = 0;
    if (rest) {
      const [agg] = await this.db
        .select({
          count: sql<number>`count(*)::int`,
          avg: sql<number>`coalesce(avg(${foodOrderRatings.rating}), 0)::float`,
        })
        .from(foodOrderRatings)
        .where(eq(foodOrderRatings.restaurantId, rest.id));

      if (agg && Number(agg.count) > 0) {
        ratingAvg = Math.round(Number(agg.avg) * 10) / 10;
        ratingCount = Number(agg.count);
      } else if (rest.ratingAvg && Number(rest.ratingAvg) > 0) {
        ratingAvg = Math.round(Number(rest.ratingAvg) * 10) / 10;
        ratingCount = 0;
      }
    }

    const isOpenNow = isVendorOpenNow(row);

    return {
      ...row,
      isOpenNow,
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      mustChangePassword: user?.mustChangePassword ?? false,
      ratingAvg,
      ratingCount,
    };
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
          ...(dto.shopAddress !== undefined ? { shopAddress: dto.shopAddress } : {}),
          ...(dto.gstNumber !== undefined ? { gstNumber: dto.gstNumber } : {}),
          ...(dto.aadhaarNumber !== undefined ? { aadhaarNumber: dto.aadhaarNumber } : {}),
          ...(dto.bankAccount !== undefined ? { bankAccount: dto.bankAccount } : {}),
          ...(dto.bankIfsc !== undefined ? { bankIfsc: dto.bankIfsc } : {}),
          ...(dto.upiId !== undefined ? { upiId: dto.upiId } : {}),
          pickupLat: dto.pickupLat,
          pickupLng: dto.pickupLng,
          ...(dto.radiusKm !== undefined ? { radiusKm: dto.radiusKm } : {}),
          ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
          ...(dto.businessType !== undefined ? { businessType: dto.businessType } : {}),
        })
        .where(eq(vendors.id, existing.id))
        .returning();

      if (dto.imageUrl) {
        await this.db.update(restaurants).set({ imageUrl: dto.imageUrl }).where(eq(restaurants.vendorId, existing.id));
      }
      return updated;
    }
    const [created] = await this.db
      .insert(vendors)
      .values({
        userId,
        businessName: dto.businessName,
        ownerName: dto.ownerName,
        type: dto.type,
        shopAddress: dto.shopAddress ?? null,
        gstNumber: dto.gstNumber ?? null,
        aadhaarNumber: dto.aadhaarNumber ?? null,
        bankAccount: dto.bankAccount ?? null,
        bankIfsc: dto.bankIfsc ?? null,
        upiId: dto.upiId ?? null,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        ...(dto.radiusKm !== undefined ? { radiusKm: dto.radiusKm } : {}),
        imageUrl: dto.imageUrl ?? null,
        businessType: dto.businessType ?? (dto.type === 'restaurant' ? 'restaurant' : 'grocery'),
      })
      .returning();

    if (dto.imageUrl) {
      await this.db.update(restaurants).set({ imageUrl: dto.imageUrl }).where(eq(restaurants.vendorId, created.id));
    }
    return created;
  }

  // Post-Phase-11 MVP-completion pass (Business Hours). Single call for the
  // vendor app's one settings screen — updates the manual master switch and
  // the weekly schedule together, since that screen saves both at once.
  async updateBusinessHours(userId: string, dto: UpdateBusinessHoursDto) {
    const vendor = await this.requireVendor(userId);
    const updateData: { isOpen: boolean; businessHours?: any } = { isOpen: dto.isOpen };
    if (dto.schedule !== undefined) {
      updateData.businessHours = dto.schedule;
    }
    const [updated] = await this.db
      .update(vendors)
      .set(updateData)
      .where(eq(vendors.id, vendor.id))
      .returning();

    // Keep restaurants table in sync if this vendor operates a restaurant
    await this.db
      .update(restaurants)
      .set({ isOpen: dto.isOpen })
      .where(eq(restaurants.vendorId, vendor.id));

    return {
      ...updated,
      isOpenNow: isVendorOpenNow(updated),
    };
  }

  async deleteVendorAccount(userId: string) {
    const vendor = await this.requireVendor(userId);

    // 1. Verify no active orders in progress
    const activeGrocery = await this.db
      .select({ id: groceryOrders.id })
      .from(groceryOrders)
      .where(
        and(
          eq(groceryOrders.vendorId, vendor.id),
          inArray(groceryOrders.status, [
            'placed',
            'vendor_accepted',
            'preparing',
            'ready',
            'handed_over',
            'delivery_assigned',
            'picked_up',
            'out_for_delivery',
          ]),
        ),
      )
      .limit(1);

    const [restaurant] = await this.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.vendorId, vendor.id))
      .limit(1);

    let activeFood: { id: string }[] = [];
    if (restaurant) {
      activeFood = await this.db
        .select({ id: foodOrders.id })
        .from(foodOrders)
        .where(
          and(
            eq(foodOrders.restaurantId, restaurant.id),
            inArray(foodOrders.status, [
              'placed',
              'vendor_accepted',
              'preparing',
              'ready',
              'handed_over',
              'delivery_assigned',
              'picked_up',
              'out_for_delivery',
            ]),
          ),
        )
        .limit(1);
    }

    if (activeGrocery.length > 0 || activeFood.length > 0) {
      throw new BadRequestException(
        'Cannot delete account while you have active orders in progress. Please complete or cancel remaining orders first.',
      );
    }

    // 2. Mark vendor and restaurant as closed
    await this.db.update(vendors).set({ isOpen: false }).where(eq(vendors.id, vendor.id));
    if (restaurant) {
      await this.db.update(restaurants).set({ isOpen: false }).where(eq(restaurants.id, restaurant.id));
    }

    // 3. Mark user suspended and scrub identifiers
    await this.db
      .update(users)
      .set({ status: 'suspended', phone: null, email: null })
      .where(eq(users.id, userId));

    // 4. Revoke auth tokens
    await this.db
      .update(authTokens)
      .set({ revokedAt: new Date() })
      .where(eq(authTokens.userId, userId));

    return { success: true, message: 'Vendor account deleted successfully.' };
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
    const byId = new Map(all.map((c) => [c.id, c]));
    const roots = all.filter((c) => !c.parentId);
    return roots.map((root) => ({
      id: root.id,
      name: root.name,
      imageUrl: root.imageUrl,
      businessType: categoryBusinessType(root, byId),
      subcategories: all
        .filter((c) => c.parentId === root.id)
        .map((sub) => ({
          id: sub.id,
          name: sub.name,
          imageUrl: sub.imageUrl,
          parentId: sub.parentId,
          businessType: categoryBusinessType(sub, byId),
          productCount: countByCategory.get(sub.id) ?? 0,
        })),
    }));
  }

  async createCategory(dto: CreateCategoryDto) {
    const [row] = await this.db.insert(categories).values(dto).returning();
    return row;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const updateData = {
      ...dto,
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
    };
    const [row] = await this.db.update(categories).set(updateData).where(eq(categories.id, id)).returning();
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }

  async deleteCategory(id: string) {
    const [cat] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    if (!cat) throw new NotFoundException('Category not found');

    // 1. Check if the category directly contains products
    const [directProduct] = await this.db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.categoryId, id))
      .limit(1);

    if (directProduct) {
      throw new ConflictException(
        `Cannot delete category "${cat.name}" because it contains products. Please delete or reassign its products first.`,
      );
    }

    // 2. Check for subcategories and whether any subcategory contains products
    const subcats = await this.db
      .select()
      .from(categories)
      .where(eq(categories.parentId, id));

    if (subcats.length > 0) {
      const subcatIds = subcats.map((s) => s.id);
      const [subProduct] = await this.db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(inArray(products.categoryId, subcatIds))
        .limit(1);

      if (subProduct) {
        throw new ConflictException(
          `Cannot delete category "${cat.name}" because its subcategories contain products. Please delete or reassign products first.`,
        );
      }
    }

    const allCatIds = [id, ...subcats.map((s) => s.id)];

    // 3. Clean up any product suggestions referencing this category or its subcategories
    await this.db
      .delete(productSuggestions)
      .where(inArray(productSuggestions.categoryId, allCatIds));

    // 4. Delete subcategories if any
    if (subcats.length > 0) {
      await this.db
        .delete(categories)
        .where(inArray(categories.id, subcats.map((s) => s.id)));
    }

    // 5. Delete the category itself
    await this.db.delete(categories).where(eq(categories.id, id));
    return { success: true, message: `Category "${cat.name}" deleted successfully.` };
  }

  // ---------- Admin + Vendor: master product catalog ----------

  listProducts(categoryId?: string) {
    return this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.status, 'active'),
          categoryId ? eq(products.categoryId, categoryId) : undefined,
        ),
      );
  }

  async getProduct(id: string) {
    const [row] = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!row) throw new NotFoundException('Product not found');
    return row;
  }

  async createProduct(dto: CreateProductDto & { attributes?: Record<string, string | number | boolean> | null }) {
    const [row] = await this.db.insert(products).values(dto).returning();
    return row;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const updateData = {
      ...dto,
      ...(dto.brand !== undefined ? { brand: dto.brand || null } : {}),
      ...(dto.description !== undefined ? { description: dto.description || null } : {}),
      ...(dto.size !== undefined ? { size: dto.size || null } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
    };
    const [row] = await this.db.update(products).set(updateData).where(eq(products.id, id)).returning();
    if (!row) throw new NotFoundException('Product not found');
    return row;
  }

  async deleteProduct(id: string) {
    const [prod] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!prod) throw new NotFoundException('Product not found');

    // 1. Check if the product is linked to any customer orders
    const [orderItem] = await this.db
      .select({ id: groceryOrderItems.id })
      .from(groceryOrderItems)
      .where(eq(groceryOrderItems.productId, id))
      .limit(1);

    if (orderItem) {
      throw new ConflictException(
        `Cannot delete product "${prod.name}" because it is linked to existing customer orders. Please set its status to inactive instead.`,
      );
    }

    // 2. Disassociate any product suggestions pointing to this product (productId is nullable)
    await this.db
      .update(productSuggestions)
      .set({ productId: null })
      .where(eq(productSuggestions.productId, id));

    // 3. Clean up any vendor product listings for this product
    await this.db
      .delete(vendorProducts)
      .where(eq(vendorProducts.productId, id));

    // 4. Delete the product
    await this.db.delete(products).where(eq(products.id, id));
    return { success: true, message: `Product "${prod.name}" deleted successfully.` };
  }

  // ---------- Vendor: categories & catalog for its business type ----------

  private async categoryIdsVisibleTo(businessType: string) {
    const all = await this.listCategoriesFlat();
    const byId = new Map(all.map((c) => [c.id, c]));
    return {
      all,
      visible: new Set(
        all.filter((c) => isCategoryVisibleTo(categoryBusinessType(c, byId), businessType)).map((c) => c.id),
      ),
    };
  }

  // Categories a vendor can file products under: leaves only (a root with
  // subcategories is just a grouping), limited to its business type.
  async listVendorCategories(vendor: { businessType: string }) {
    const { all, visible } = await this.categoryIdsVisibleTo(vendor.businessType);
    const parentIds = new Set(all.map((c) => c.parentId));
    return all.filter((c) => visible.has(c.id) && !parentIds.has(c.id));
  }

  // For when none of the business type's categories fit. Filed under that
  // type's root category (created on first use); an existing category with
  // the same name is returned instead of creating a duplicate.
  async createVendorCategory(vendor: { businessType: string }, name: string) {
    const rootName = BUSINESS_TYPE_ROOT_CATEGORY[vendor.businessType];
    if (!rootName) {
      throw new BadRequestException('Restaurants manage menu categories from the menu screen');
    }
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Category name is required');
    const existing = (await this.listVendorCategories(vendor)).find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;

    let [root] = await this.db
      .select()
      .from(categories)
      .where(
        and(
          isNull(categories.parentId),
          eq(categories.businessType, vendor.businessType),
          ilike(categories.name, rootName),
        ),
      )
      .limit(1);
    if (!root) {
      [root] = await this.db
        .insert(categories)
        .values({ name: rootName, businessType: vendor.businessType })
        .returning();
    }
    const [created] = await this.db
      .insert(categories)
      .values({ name: trimmed, parentId: root.id, businessType: vendor.businessType })
      .returning();
    return created;
  }

  // Master catalog as a vendor browses it: only products in its business
  // type's categories, so a clothing store isn't shown groceries.
  async listVendorCatalogProducts(vendor: { businessType: string }, categoryId?: string) {
    const [{ visible }, rows] = await Promise.all([
      this.categoryIdsVisibleTo(vendor.businessType),
      this.listProducts(categoryId),
    ]);
    return rows.filter((p) => visible.has(p.categoryId));
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
          offerTag: dto.offerTag !== undefined ? dto.offerTag || null : existing.offerTag,
          lowStockThreshold:
            dto.lowStockThreshold !== undefined ? dto.lowStockThreshold : existing.lowStockThreshold,
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
        offerTag: dto.offerTag || null,
        lowStockThreshold: dto.lowStockThreshold,
      })
      .returning();
    return created;
  }

  async createVendorProduct(vendor: { id: string; businessType: string }, dto: CreateGroceryProductDto) {
    const attributes =
      dto.attributes === undefined
        ? null
        : readProductAttributes(productFormFor(vendor.businessType), { ...dto, attributes: dto.attributes });
    const product = await this.createProduct({
      categoryId: dto.categoryId,
      name: dto.name,
      brand: dto.brand,
      unit: dto.unit,
      size: dto.size,
      mrp: dto.mrp,
      imageUrl: dto.imageUrl,
      attributes,
    });

    const listing = await this.upsertVendorProduct(vendor.id, {
      productId: product.id,
      price: dto.price,
      stockQty: dto.stockQty,
      isAvailable: true,
      offerTag: dto.offerTag,
      lowStockThreshold: dto.lowStockThreshold,
    });

    return { ...listing, product };
  }

  private async requireOwnVendorProduct(vendorId: string, id: string) {
    const [row] = await this.db.select().from(vendorProducts).where(eq(vendorProducts.id, id)).limit(1);
    if (!row) throw new NotFoundException('Listing not found');
    if (row.vendorId !== vendorId) throw new ForbiddenException('Not your listing');
    return row;
  }

  async updateVendorProduct(vendorId: string, id: string, dto: UpdateVendorProductDto) {
    const row = await this.requireOwnVendorProduct(vendorId, id);

    const productUpdates: Record<string, any> = {};
    if (dto.name !== undefined) productUpdates.name = dto.name;
    if (dto.brand !== undefined) productUpdates.brand = dto.brand || null;
    if (dto.categoryId !== undefined) productUpdates.categoryId = dto.categoryId;
    if (dto.unit !== undefined) productUpdates.unit = dto.unit;
    if (dto.size !== undefined) productUpdates.size = dto.size || null;
    if (dto.mrp !== undefined) productUpdates.mrp = dto.mrp;
    if (dto.imageUrl !== undefined) productUpdates.imageUrl = dto.imageUrl || null;
    if (dto.description !== undefined) productUpdates.description = dto.description || null;

    if (Object.keys(productUpdates).length > 0) {
      await this.db.update(products).set(productUpdates).where(eq(products.id, row.productId));
    }

    const listingUpdates: Record<string, any> = { updatedAt: new Date() };
    if (dto.price !== undefined) listingUpdates.price = dto.price;
    if (dto.stockQty !== undefined) listingUpdates.stockQty = dto.stockQty;
    if (dto.isAvailable !== undefined) listingUpdates.isAvailable = dto.isAvailable;
    if (dto.offerTag !== undefined) listingUpdates.offerTag = dto.offerTag || null;
    if (dto.lowStockThreshold !== undefined) listingUpdates.lowStockThreshold = dto.lowStockThreshold;

    const [updated] = await this.db
      .update(vendorProducts)
      .set(listingUpdates)
      .where(eq(vendorProducts.id, id))
      .returning();

    const [product] = await this.db.select().from(products).where(eq(products.id, row.productId)).limit(1);
    return { ...updated, product };
  }

  async deleteVendorProduct(vendorId: string, id: string) {
    const row = await this.requireOwnVendorProduct(vendorId, id);
    await this.db.delete(vendorProducts).where(eq(vendorProducts.id, id));

    const [orderItem] = await this.db
      .select({ id: groceryOrderItems.id })
      .from(groceryOrderItems)
      .where(eq(groceryOrderItems.productId, row.productId))
      .limit(1);

    if (!orderItem) {
      const otherListings = await this.db
        .select()
        .from(vendorProducts)
        .where(eq(vendorProducts.productId, row.productId))
        .limit(1);
      if (otherListings.length === 0) {
        await this.db.delete(products).where(eq(products.id, row.productId));
      }
    }
    return { success: true };
  }

  async createVendorCustomProduct(vendorId: string, dto: CreateVendorCustomProductDto) {
    const [product] = await this.db
      .insert(products)
      .values({
        categoryId: dto.categoryId,
        brand: dto.brand || null,
        name: dto.name,
        description: dto.description || null,
        unit: dto.unit,
        size: dto.size || null,
        mrp: dto.mrp ?? null,
        imageUrl: dto.imageUrl || null,
        status: 'active',
      })
      .returning();

    const [listing] = await this.db
      .insert(vendorProducts)
      .values({
        vendorId,
        productId: product.id,
        price: dto.price,
        stockQty: dto.stockQty ?? 0,
        isAvailable: dto.isAvailable ?? true,
      })
      .returning();

    return { ...listing, product };
  }

  async updateVendorCustomProduct(vendorId: string, productId: string, dto: UpdateVendorCustomProductDto) {
    const [listing] = await this.db
      .select()
      .from(vendorProducts)
      .where(and(eq(vendorProducts.vendorId, vendorId), eq(vendorProducts.productId, productId)))
      .limit(1);

    if (!listing) throw new NotFoundException('Product listing not found');

    const productUpdates: Record<string, any> = {};
    if (dto.name !== undefined) productUpdates.name = dto.name;
    if (dto.brand !== undefined) productUpdates.brand = dto.brand || null;
    if (dto.categoryId !== undefined) productUpdates.categoryId = dto.categoryId;
    if (dto.unit !== undefined) productUpdates.unit = dto.unit;
    if (dto.size !== undefined) productUpdates.size = dto.size || null;
    if (dto.mrp !== undefined) productUpdates.mrp = dto.mrp;
    if (dto.imageUrl !== undefined) productUpdates.imageUrl = dto.imageUrl || null;
    if (dto.description !== undefined) productUpdates.description = dto.description || null;

    let updatedProduct: any = null;
    if (Object.keys(productUpdates).length > 0) {
      const [p] = await this.db
        .update(products)
        .set(productUpdates)
        .where(eq(products.id, productId))
        .returning();
      updatedProduct = p;
    } else {
      updatedProduct = await this.getProduct(productId);
    }

    const listingUpdates: Record<string, any> = { updatedAt: new Date() };
    if (dto.price !== undefined) listingUpdates.price = dto.price;
    if (dto.stockQty !== undefined) listingUpdates.stockQty = dto.stockQty;
    if (dto.isAvailable !== undefined) listingUpdates.isAvailable = dto.isAvailable;

    const [updatedListing] = await this.db
      .update(vendorProducts)
      .set(listingUpdates)
      .where(eq(vendorProducts.id, listing.id))
      .returning();

    return { ...updatedListing, product: updatedProduct };
  }

  async deleteVendorCustomProduct(vendorId: string, productId: string) {
    const [listing] = await this.db
      .select()
      .from(vendorProducts)
      .where(and(eq(vendorProducts.vendorId, vendorId), eq(vendorProducts.productId, productId)))
      .limit(1);

    if (!listing) throw new NotFoundException('Product listing not found');

    await this.db.delete(vendorProducts).where(eq(vendorProducts.id, listing.id));

    const [orderItem] = await this.db
      .select({ id: groceryOrderItems.id })
      .from(groceryOrderItems)
      .where(eq(groceryOrderItems.productId, productId))
      .limit(1);

    if (!orderItem) {
      const otherListings = await this.db
        .select()
        .from(vendorProducts)
        .where(eq(vendorProducts.productId, productId))
        .limit(1);
      if (otherListings.length === 0) {
        await this.db.delete(products).where(eq(products.id, productId));
      }
    }

    return { success: true };
  }

  // ---------- Public: customer browse (grocery) ----------

  /**
   * Vendor ids whose pickup point is within their own configured radius of
   * (lat, lng) AND are currently open (Business Hours, post-Phase-11 pass)
   * — a closed vendor must not appear in customer catalog/restaurant
   * browse, same rule Allocation enforces on its own vendor query.
   */
  private async vendorsInRadius(lat: number, lng: number) {
    const allVendors = await this.db.select().from(vendors);
    return allVendors.filter(
      (v) => isVendorOpenNow(v) && haversineKm(lat, lng, v.pickupLat, v.pickupLng) <= v.radiusKm,
    );
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
    const allVendors = await this.db.select().from(vendors);
    const nearbyVendors = allVendors.filter(
      (v) => v.isOpen && haversineKm(lat, lng, v.pickupLat, v.pickupLng) <= v.radiusKm,
    );
    const vendorMap = new Map(nearbyVendors.map((v) => [v.id, v]));
    const vendorIds = nearbyVendors.filter((v) => v.type !== 'grocery').map((v) => v.id);
    if (vendorIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(restaurants)
      .where(and(inArray(restaurants.vendorId, vendorIds), eq(restaurants.isOpen, true)));

    const restIds = rows.map((r) => r.id);
    const ratingsMap = new Map<string, { count: number; avg: number }>();
    if (restIds.length > 0) {
      const aggRows = await this.db
        .select({
          restaurantId: foodOrderRatings.restaurantId,
          count: sql<number>`count(*)::int`,
          avg: sql<number>`coalesce(avg(${foodOrderRatings.rating}), 0)::float`,
        })
        .from(foodOrderRatings)
        .where(inArray(foodOrderRatings.restaurantId, restIds))
        .groupBy(foodOrderRatings.restaurantId);

      for (const agg of aggRows) {
        ratingsMap.set(agg.restaurantId, {
          count: Number(agg.count),
          avg: Math.round(Number(agg.avg) * 10) / 10,
        });
      }
    }

    return rows.map((r) => {
      const v = vendorMap.get(r.vendorId);
      const openNow = r.isOpen && (v ? isVendorOpenNow(v) : false);
      const agg = ratingsMap.get(r.id);
      const dynamicRating = agg && agg.count > 0 ? agg.avg : (r.ratingAvg > 0 ? Math.round(r.ratingAvg * 10) / 10 : 4.8);
      const dynamicCount = agg ? agg.count : 0;
      return {
        ...r,
        imageUrl: r.imageUrl || v?.imageUrl || null,
        ratingAvg: dynamicRating,
        ratingCount: dynamicCount,
        isOpen: openNow,
      };
    });
  }

  async publicGetRestaurant(id: string) {
    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, restaurant.vendorId)).limit(1);
    const openNow = restaurant.isOpen && (vendor ? isVendorOpenNow(vendor) : false);

    const [ratingsAgg] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
        avg: sql<number>`coalesce(avg(${foodOrderRatings.rating}), 0)::float`,
      })
      .from(foodOrderRatings)
      .where(eq(foodOrderRatings.restaurantId, id));

    const dynamicRating = ratingsAgg && Number(ratingsAgg.count) > 0
      ? Math.round(Number(ratingsAgg.avg) * 10) / 10
      : (restaurant.ratingAvg > 0 ? Math.round(restaurant.ratingAvg * 10) / 10 : 4.8);
    const dynamicCount = ratingsAgg ? Number(ratingsAgg.count) : 0;

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
      imageUrl: restaurant.imageUrl || vendor?.imageUrl || null,
      ratingAvg: dynamicRating,
      ratingCount: dynamicCount,
      isOpen: openNow,
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

  async publicSearch(lat: number, lng: number, query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      return { products: [], restaurants: [], dishes: [] };
    }

    const inRadius = await this.vendorsInRadius(lat, lng);
    const groceryVendorIds = inRadius.filter((v) => (v.type === 'grocery' || v.type === 'both') && v.isOpen).map((v) => v.id);
    const restaurantVendorIds = inRadius.filter((v) => v.type !== 'grocery' && v.isOpen).map((v) => v.id);

    // 1. Matched products
    let productsList: any[] = [];
    if (groceryVendorIds.length > 0) {
      const pRows = await this.db
        .select({ vendorProduct: vendorProducts, product: products })
        .from(vendorProducts)
        .innerJoin(products, eq(vendorProducts.productId, products.id))
        .where(
          and(
            inArray(vendorProducts.vendorId, groceryVendorIds),
            eq(vendorProducts.isAvailable, true),
            eq(products.status, 'active'),
            ilike(products.name, `%${trimmed}%`),
          ),
        );
      productsList = this.aggregateByProduct(pRows);
    }

    // Direct active catalog products fallback so search always succeeds even if vendor radius is unmatched
    if (productsList.length === 0) {
      const fallbackProducts = await this.db
        .select()
        .from(products)
        .where(
          and(
            eq(products.status, 'active'),
            or(
              ilike(products.name, `%${trimmed}%`),
              ilike(products.description, `%${trimmed}%`),
              ilike(products.unit, `%${trimmed}%`),
            ),
          ),
        )
        .limit(30);

      productsList = fallbackProducts.map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        unit: p.unit,
        imageUrl: p.imageUrl,
        description: p.description,
        mrp: p.mrp,
        price: p.mrp ?? 0,
        inStock: true,
      }));
    }

    // 2. Matched restaurants
    let matchedRestaurants: any[] = [];
    if (restaurantVendorIds.length > 0) {
      matchedRestaurants = await this.db
        .select()
        .from(restaurants)
        .where(
          and(
            inArray(restaurants.vendorId, restaurantVendorIds),
            eq(restaurants.isOpen, true),
            or(
              ilike(restaurants.name, `%${trimmed}%`),
              ilike(restaurants.cuisineTags, `%${trimmed}%`),
            ),
          ),
        );
    }

    if (matchedRestaurants.length === 0) {
      matchedRestaurants = await this.db
        .select()
        .from(restaurants)
        .where(
          or(
            ilike(restaurants.name, `%${trimmed}%`),
            ilike(restaurants.cuisineTags, `%${trimmed}%`),
          ),
        )
        .limit(15);
    }

    // 3. Matched dishes (menu items from active restaurants)
    let dishesList: any[] = [];
    if (restaurantVendorIds.length > 0) {
      const activeRestaurants = await this.db
        .select()
        .from(restaurants)
        .where(
          and(
            inArray(restaurants.vendorId, restaurantVendorIds),
            eq(restaurants.isOpen, true),
          ),
        );
      const restIds = activeRestaurants.map((r) => r.id);
      if (restIds.length > 0) {
        const catRows = await this.db
          .select()
          .from(menuCategories)
          .where(inArray(menuCategories.restaurantId, restIds));
        const catIds = catRows.map((c) => c.id);
        if (catIds.length > 0) {
          const restMap = new Map(activeRestaurants.map((r) => [r.id, r]));
          const catMap = new Map(catRows.map((c) => [c.id, c.restaurantId]));

          const itemRows = await this.db
            .select()
            .from(menuItems)
            .where(
              and(
                inArray(menuItems.menuCategoryId, catIds),
                eq(menuItems.isAvailable, true),
                ilike(menuItems.name, `%${trimmed}%`),
              ),
            );

          dishesList = itemRows.map((item) => {
            const rId = catMap.get(item.menuCategoryId)!;
            const rest = restMap.get(rId);
            return {
              id: item.id,
              restaurantId: rId,
              restaurantName: rest?.name ?? 'Restaurant',
              name: item.name,
              description: item.description,
              price: item.price,
              imageUrl: item.imageUrl,
              isVeg: item.isVeg,
              isAvailable: item.isAvailable,
            };
          });
        }
      }
    }

    if (dishesList.length === 0) {
      const menuRows = await this.db
        .select({
          item: menuItems,
          cat: menuCategories,
          rest: restaurants,
        })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuItems.menuCategoryId, menuCategories.id))
        .innerJoin(restaurants, eq(menuCategories.restaurantId, restaurants.id))
        .where(
          or(
            ilike(menuItems.name, `%${trimmed}%`),
            ilike(menuItems.description, `%${trimmed}%`),
          ),
        )
        .limit(20);

      dishesList = menuRows.map(({ item, rest }) => ({
        id: item.id,
        restaurantId: rest.id,
        restaurantName: rest.name,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        isVeg: item.isVeg,
        isAvailable: item.isAvailable,
      }));
    }

    return {
      products: productsList,
      restaurants: matchedRestaurants,
      dishes: dishesList,
    };
  }

  // ---------- Vendor: own restaurant + menu ----------

  async getOrCreateRestaurant(vendorId: string) {
    const [existing] = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, vendorId)).limit(1);
    if (existing) return existing;

    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) throw new NotFoundException('Vendor not found');

    const [created] = await this.db.insert(restaurants).values({ vendorId, name: vendor.businessName }).returning();
    return created;
  }

  // Post-Phase-11 MVP-completion pass (Ratings). Recomputed from
  // food_order_ratings on every new rating rather than incrementally
  // averaged — one restaurant's rating count is small enough at MVP scale
  // that a plain re-aggregate is simpler and can't drift from a running-sum
  // bug. Called by OrderService.rateFoodOrder right after the insert.
  async recalcRestaurantRating(restaurantId: string) {
    const rows = await this.db
      .select({ rating: foodOrderRatings.rating })
      .from(foodOrderRatings)
      .where(eq(foodOrderRatings.restaurantId, restaurantId));
    const avg = rows.length ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length : 0;
    await this.db
      .update(restaurants)
      .set({ ratingAvg: Math.round(avg * 10) / 10 })
      .where(eq(restaurants.id, restaurantId));
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
    const updateData = {
      ...fields,
      ...(fields.imageUrl !== undefined ? { imageUrl: fields.imageUrl || null } : {}),
      ...(fields.description !== undefined ? { description: fields.description || null } : {}),
    };
    const [updated] = await this.db.update(menuItems).set(updateData).where(eq(menuItems.id, id)).returning();
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

  // ---------- Admin Vendor Management (CRUD & Welcome Email) ----------

  async listVendorsAdmin() {
    const rows = await this.db
      .select({
        vendor: vendors,
        user: users,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .orderBy(desc(vendors.createdAt));

    return rows.map(({ vendor, user }) => ({
      id: vendor.id,
      userId: vendor.userId,
      businessName: vendor.businessName,
      ownerName: vendor.ownerName,
      phone: user.phone,
      email: user.email,
      type: vendor.type,
      shopAddress: vendor.shopAddress,
      gstNumber: vendor.gstNumber,
      aadhaarNumber: vendor.aadhaarNumber,
      bankAccount: vendor.bankAccount,
      bankIfsc: vendor.bankIfsc,
      upiId: vendor.upiId,
      kycStatus: vendor.kycStatus,
      activity: vendor.isOpen ? 'active' : 'inactive',
      isOpen: vendor.isOpen,
      deliveryRadiusKm: vendor.radiusKm,
      commissionPct: 10,
      cashbackPct: 5,
      discountPct: 0,
      createdAt: vendor.createdAt,
    }));
  }

  async getAdminVendor(id: string) {
    const [row] = await this.db
      .select({
        vendor: vendors,
        user: users,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(eq(vendors.id, id))
      .limit(1);

    if (!row) throw new NotFoundException('Vendor not found');
    const { vendor, user } = row;

    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, id)).limit(1);
    const vendorProds = await this.db.select().from(vendorProducts).where(eq(vendorProducts.vendorId, id));

    return {
      id: vendor.id,
      userId: vendor.userId,
      businessName: vendor.businessName,
      ownerName: vendor.ownerName,
      phone: user.phone,
      email: user.email,
      type: vendor.type,
      shopAddress: vendor.shopAddress,
      gstNumber: vendor.gstNumber,
      aadhaarNumber: vendor.aadhaarNumber,
      bankAccount: vendor.bankAccount,
      bankIfsc: vendor.bankIfsc,
      upiId: vendor.upiId,
      kycStatus: vendor.kycStatus,
      activity: vendor.isOpen ? 'active' : 'inactive',
      isOpen: vendor.isOpen,
      deliveryRadiusKm: vendor.radiusKm,
      commissionPct: 10,
      cashbackPct: 5,
      discountPct: 0,
      rating: restaurant?.ratingAvg ?? 4.8,
      ratingCount: 12,
      productCount: vendorProds.length,
      createdAt: vendor.createdAt,
    };
  }

  async createAdminVendor(dto: CreateAdminVendorDto) {
    const phone = dto.phone.trim();
    const email = dto.email && dto.email.trim() ? dto.email.trim().toLowerCase() : null;

    // Generate a secure, readable random temporary password for the invited vendor (e.g. LJ#7k9m2)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(randomInt(0, chars.length));
    }
    const tempPassword = `LJ#${rand}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    let [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          email ? or(eq(users.phone, phone), ilike(users.email, email)) : eq(users.phone, phone),
          eq(users.role, 'vendor'),
        ),
      )
      .limit(1);

    if (!user) {
      [user] = await this.db
        .insert(users)
        .values({
          phone,
          email,
          role: 'vendor',
          status: 'active',
          passwordHash,
          mustChangePassword: true,
        })
        .returning();
    } else {
      const [existingVendor] = await this.db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);
      if (existingVendor) {
        throw new ConflictException(`A vendor profile already exists for phone ${phone} or email ${email ?? ''}`);
      }
      [user] = await this.db
        .update(users)
        .set({
          phone,
          ...(email ? { email } : {}),
          passwordHash,
          mustChangePassword: true,
        })
        .where(eq(users.id, user.id))
        .returning();
    }

    const kycStat = (dto.kycStatus === 'verified' || dto.kycStatus === 'rejected') ? dto.kycStatus : 'pending';

    const [vendor] = await this.db
      .insert(vendors)
      .values({
        userId: user.id,
        businessName: dto.businessName.trim(),
        ownerName: dto.ownerName.trim(),
        type: dto.type,
        shopAddress: dto.shopAddress?.trim() || null,
        gstNumber: dto.gstNumber?.trim() || null,
        aadhaarNumber: dto.aadhaarNumber?.trim() || null,
        bankAccount: dto.bankAccount?.trim() || null,
        bankIfsc: dto.bankIfsc?.trim().toUpperCase() || null,
        upiId: dto.upiId?.trim() || null,
        pickupLat: dto.pickupLat ?? 24.924,
        pickupLng: dto.pickupLng ?? 76.283,
        radiusKm: dto.deliveryRadiusKm ?? 5,
        kycStatus: kycStat,
        isOpen: true,
      })
      .returning();

    if (dto.type === 'restaurant' || dto.type === 'both') {
      const [existingRest] = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, vendor.id)).limit(1);
      if (!existingRest) {
        await this.db.insert(restaurants).values({
          vendorId: vendor.id,
          name: dto.businessName.trim(),
        });
      }
    }

    // Send Welcome Email with credentials and APK download/install instructions
    if (email) {
      try {
        this.notifications.sendWelcomeVendorEmail({
          id: user.id,
          businessName: dto.businessName.trim(),
          ownerName: dto.ownerName.trim(),
          email,
          phone,
          type: dto.type,
          tempPassword,
        });
      } catch (err) {
        console.error('[CatalogService] Failed to queue welcome vendor email:', err);
      }
    }

    return {
      id: vendor.id,
      userId: vendor.userId,
      businessName: vendor.businessName,
      ownerName: vendor.ownerName,
      phone,
      email,
      type: vendor.type,
      shopAddress: vendor.shopAddress,
      gstNumber: vendor.gstNumber,
      aadhaarNumber: vendor.aadhaarNumber,
      bankAccount: vendor.bankAccount,
      bankIfsc: vendor.bankIfsc,
      upiId: vendor.upiId,
      kycStatus: vendor.kycStatus,
      activity: vendor.isOpen ? 'active' : 'inactive',
      deliveryRadiusKm: vendor.radiusKm,
      commissionPct: 10,
      cashbackPct: 5,
      discountPct: 0,
      tempPassword,
      createdAt: vendor.createdAt,
    };
  }

  async updateAdminVendor(id: string, dto: UpdateAdminVendorDto) {
    const [v] = await this.db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!v) throw new NotFoundException('Vendor not found');

    const updateFields: any = {};
    if (dto.businessName !== undefined) updateFields.businessName = dto.businessName;
    if (dto.ownerName !== undefined) updateFields.ownerName = dto.ownerName;
    if (dto.type !== undefined) updateFields.type = dto.type;
    if (dto.shopAddress !== undefined) updateFields.shopAddress = dto.shopAddress;
    if (dto.deliveryRadiusKm !== undefined) updateFields.radiusKm = dto.deliveryRadiusKm;
    if (dto.kycStatus !== undefined && dto.kycStatus !== 'unverified') updateFields.kycStatus = dto.kycStatus;
    if (dto.activity !== undefined) updateFields.isOpen = dto.activity === 'active';
    if (dto.isOpen !== undefined) updateFields.isOpen = dto.isOpen;
    if (dto.gstNumber !== undefined) updateFields.gstNumber = dto.gstNumber ? dto.gstNumber.trim() : null;
    if (dto.aadhaarNumber !== undefined) updateFields.aadhaarNumber = dto.aadhaarNumber ? dto.aadhaarNumber.trim() : null;
    if (dto.bankAccount !== undefined) updateFields.bankAccount = dto.bankAccount ? dto.bankAccount.trim() : null;
    if (dto.bankIfsc !== undefined) updateFields.bankIfsc = dto.bankIfsc ? dto.bankIfsc.trim().toUpperCase() : null;
    if (dto.upiId !== undefined) updateFields.upiId = dto.upiId ? dto.upiId.trim() : null;

    if (Object.keys(updateFields).length > 0) {
      await this.db.update(vendors).set(updateFields).where(eq(vendors.id, id));
      if (updateFields.isOpen !== undefined) {
        await this.db.update(restaurants).set({ isOpen: updateFields.isOpen }).where(eq(restaurants.vendorId, id));
      }
    }

    if (dto.phone !== undefined || dto.email !== undefined) {
      const userUpdates: any = {};
      if (dto.phone !== undefined && dto.phone.trim()) userUpdates.phone = dto.phone.trim();
      if (dto.email !== undefined) userUpdates.email = dto.email.trim() ? dto.email.trim().toLowerCase() : null;
      if (Object.keys(userUpdates).length > 0) {
        await this.db.update(users).set(userUpdates).where(eq(users.id, v.userId));
      }
    }

    return this.getAdminVendor(id);
  }

  async deleteAdminVendor(id: string) {
    const [v] = await this.db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!v) throw new NotFoundException('Vendor not found');

    await this.db.delete(vendors).where(eq(vendors.id, id));
    return { success: true, message: `Vendor ${id} deleted successfully.` };
  }
}
