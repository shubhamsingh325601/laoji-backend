import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  authTokens,
  categories,
  categorySuggestions,
  foodOrderRatings,
  foodOrders,
  groceryOrderItems,
  groceryOrders,
  kycDocuments,
  menuCategories,
  menuItemAddons,
  menuItems,
  menuItemVariants,
  productSuggestions,
  products,
  restaurants,
  revenueConfig,
  users,
  vendorDiscounts,
  vendorProducts,
  vendors,
} from '../../../drizzle/schema';
import {
  BUSINESS_TYPE_ROOT_CATEGORY,
  categoryBusinessType,
  DEFAULT_PICKUP,
  haversineKm,
  isCategoryVisibleTo,
  isDefaultPickup,
  istDateString,
  isVendorOpenNow,
  isWithinSchedule,
  roundKm,
} from './catalog.types';
import { productFormFor, readProductAttributes } from './product-forms';
import {
  laojiCategoryId,
  normalizeAttributes,
  ownCopiesByTemplate,
  productDetailChanges,
  shopCategoryId,
  type ProductDetailInput,
} from './catalog-ownership';
import {
  effectiveMealTimings,
  isServedNow,
  mealTimingsView,
  normalizeMealSlots,
  validateMealTimings,
} from './meal-slots';
import type { UpdateBusinessHoursDto } from './dto/business-hours.dto';
import type { UpdateMealTimingsDto } from './dto/meal-timings.dto';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import type { CreateProductSuggestionDto } from './dto/product-suggestion.dto';
import type { ApproveCategorySuggestionDto, CreateCategorySuggestionDto } from './dto/category-suggestion.dto';
import type { CreateAdminVendorDto, ReorderVendorsDto, UpdateAdminVendorDto } from './dto/admin-vendor.dto';
import type { CreateAdminVendorItemDto, UpdateAdminVendorItemDto } from './dto/admin-vendor-item.dto';
import type { UpdateVendorLocationDto, UpsertVendorProfileDto } from './dto/vendor-profile.dto';
import type {
  CreateVendorCustomProductDto,
  UpdateVendorCustomProductDto,
  UpdateVendorProductDto,
  UpsertVendorProductDto,
  VendorProductDetailsDto,
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
import { VendorDiscountsService } from '../vendor-discounts/vendor-discounts.service';
import { RevenueConfigService } from '../revenue/revenue-config.service';
import {
  productSuggestionApprovedVendorPush,
  productSuggestionCreatedAdminPush,
  productSuggestionRejectedVendorPush,
} from '../notification/templates/push/product-suggestion';
import {
  categorySuggestionApprovedVendorPush,
  categorySuggestionCreatedAdminPush,
  categorySuggestionRejectedVendorPush,
} from '../notification/templates/push/category-suggestion';

type Category = typeof categories.$inferSelect;
type Product = typeof products.$inferSelect;
type Listing = typeof vendorProducts.$inferSelect;
type VendorRef = { id: string; businessType: string };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly notifications: NotificationService,
    private readonly vendorDiscounts: VendorDiscountsService,
    @Optional() private readonly revenueConfig?: RevenueConfigService,
  ) {}

  private async resolveVendorCommissionPct(vendorId: string): Promise<number> {
    try {
      if (this.revenueConfig) {
        const resolved = await this.revenueConfig.resolve(vendorId, null);
        return Math.round(resolved.commissionPct * 100 * 10) / 10;
      }
      const rows = await this.db.select().from(revenueConfig).where(lte(revenueConfig.effectiveFrom, new Date()));
      const latest = (candidates: typeof rows) =>
        candidates.length ? candidates.reduce((a, b) => (a.effectiveFrom > b.effectiveFrom ? a : b)) : null;
      const vendorRule = latest(rows.filter((r) => r.scope === 'vendor' && r.scopeRefId === vendorId));
      if (vendorRule) return Math.round(vendorRule.commissionPct * 100 * 10) / 10;
      const globalRule = latest(rows.filter((r) => r.scope === 'global'));
      if (globalRule) return Math.round(globalRule.commissionPct * 100 * 10) / 10;
    } catch {
      // ignore
    }
    return 10;
  }

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
    const commissionPct = await this.resolveVendorCommissionPct(row.id);

    return {
      ...row,
      commissionPct,
      isOpenNow,
      // Still on the fallback pickup point, i.e. never set from the shop's GPS.
      locationIsDefault: isDefaultPickup(row.pickupLat, row.pickupLng),
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
    const { pickupLat, pickupLng } = dto;
    if (existing) {
      // A profile edit only moves the pickup point when it carries a real
      // one (see DEFAULT_PICKUP for why the fallback point is ignored). The
      // delivery radius is set at signup and afterwards only by admin: app
      // builds up to 1.0.2 resend the 5 km default on every profile edit,
      // which would undo an admin's change.
      const movePickup =
        pickupLat !== undefined && pickupLng !== undefined && !isDefaultPickup(pickupLat, pickupLng);
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
          ...(movePickup ? { pickupLat, pickupLng } : {}),
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
    if (pickupLat === undefined || pickupLng === undefined) {
      throw new BadRequestException('Store location (pickupLat and pickupLng) is required');
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
        pickupLat,
        pickupLng,
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
    const updateData: { isOpen: boolean; businessHours?: any; scheduleState?: boolean } = { isOpen: dto.isOpen };
    if (dto.schedule !== undefined) {
      updateData.businessHours = dto.schedule;
      // Saving a schedule re-baselines the auto open/close switcher: the
      // toggle reflects the window the shop is in right now, and the next
      // opening/closing boundary flips it (VendorScheduleService).
      if (dto.schedule.length > 0) {
        const inWindow = isWithinSchedule(dto.schedule);
        updateData.scheduleState = inWindow;
        updateData.isOpen = dto.isOpen && inWindow;
      }
    }
    const [updated] = await this.db
      .update(vendors)
      .set(updateData)
      .where(eq(vendors.id, vendor.id))
      .returning();

    // Keep restaurants table in sync if this vendor operates a restaurant
    await this.db
      .update(restaurants)
      .set({ isOpen: updated.isOpen })
      .where(eq(restaurants.vendorId, vendor.id));

    return {
      ...updated,
      isOpenNow: isVendorOpenNow(updated),
    };
  }

  // The pickup point every nearest-vendor match measures from (customer
  // browse radius, grocery allocation, delivery-partner matching). The vendor
  // app sends the phone's GPS fix, taken at the shop.
  async updateVendorLocation(userId: string, dto: UpdateVendorLocationDto) {
    const vendor = await this.requireVendor(userId);
    if (dto.pickupLat === 0 && dto.pickupLng === 0) {
      throw new BadRequestException('Could not read a valid location. Please try again.');
    }
    const [updated] = await this.db
      .update(vendors)
      .set({ pickupLat: dto.pickupLat, pickupLng: dto.pickupLng })
      .where(eq(vendors.id, vendor.id))
      .returning();
    return { ...updated, isOpenNow: isVendorOpenNow(updated) };
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

    // 2. Delete KYC documents belonging to this vendor user
    await this.db.delete(kycDocuments).where(eq(kycDocuments.userId, userId));

    // 3. Mark vendor and restaurant as closed
    await this.db.update(vendors).set({ isOpen: false }).where(eq(vendors.id, vendor.id));
    if (restaurant) {
      await this.db.update(restaurants).set({ isOpen: false }).where(eq(restaurants.id, restaurant.id));
    }

    // 4. Mark user suspended and scrub identifiers
    await this.db
      .update(users)
      .set({ status: 'suspended', phone: null, email: null, name: null })
      .where(eq(users.id, userId));

    // 5. Revoke auth tokens
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

  // What customers browse by: Laoji's categories, plus vendors' own
  // categories that aren't a copy of a Laoji one (a copy's products are
  // shown under the Laoji category instead, see laojiCategoryId).
  async listCustomerCategories() {
    const all = await this.listCategoriesFlat();
    return all.filter((c) => c.ownerVendorId === null || c.templateCategoryId === null);
  }

  // Laoji's categories only — the templates admin manages. Vendors' own
  // store categories stay out of it; `productCount` counts Laoji products.
  async listCategoriesTree() {
    const all = (await this.listCategoriesFlat()).filter((c) => c.ownerVendorId === null);
    const laojiProducts = await this.db
      .select({ categoryId: products.categoryId })
      .from(products)
      .where(isNull(products.ownerVendorId));
    const countByCategory = new Map<string, number>();
    for (const p of laojiProducts) {
      countByCategory.set(p.categoryId, (countByCategory.get(p.categoryId) ?? 0) + 1);
    }
    const byId = new Map(all.map((c) => [c.id, c]));
    const roots = all.filter((c) => !c.parentId || !byId.has(c.parentId));
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
    const parentId =
      dto.parentId && typeof dto.parentId === 'string' && dto.parentId !== 'none' && dto.parentId.trim() !== ''
        ? dto.parentId.trim()
        : null;

    let businessType = dto.businessType;
    if (!businessType && parentId) {
      const [parent] = await this.db.select().from(categories).where(eq(categories.id, parentId)).limit(1);
      if (parent) {
        const { byId } = await this.categoryIndex();
        businessType = categoryBusinessType(parent, byId);
      }
    }

    const [row] = await this.db
      .insert(categories)
      .values({
        name: dto.name.trim(),
        parentId,
        imageUrl: dto.imageUrl?.trim() || null,
        ...(businessType ? { businessType } : {}),
      })
      .returning();
    return row;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const updateData: Partial<typeof categories.$inferInsert> = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl?.trim() || null;
    if (dto.parentId !== undefined) {
      const parentId =
        dto.parentId && typeof dto.parentId === 'string' && dto.parentId !== 'none' && dto.parentId.trim() !== ''
          ? dto.parentId.trim()
          : null;
      updateData.parentId = parentId;
      if (parentId) {
        const { byId } = await this.categoryIndex();
        const parent = byId.get(parentId);
        if (parent) {
          updateData.businessType = categoryBusinessType(parent, byId);
        }
      }
    }
    if (dto.businessType !== undefined) updateData.businessType = dto.businessType || null;

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
    if (cat.ownerVendorId !== null) {
      throw new ForbiddenException(`"${cat.name}" is a store's own category; that store manages it.`);
    }

    // 1. Find all subcategories under this category
    const subcats = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.parentId, id), isNull(categories.ownerVendorId)));

    const allCatIds = [id, ...subcats.map((s) => s.id)];

    // 2. Find all products directly under this category or any of its subcategories
    const allProducts = await this.db
      .select()
      .from(products)
      .where(inArray(products.categoryId, allCatIds));

    // Check if any product is linked to existing customer orders (groceryOrderItems)
    if (allProducts.length > 0) {
      const prodIds = allProducts.map((p) => p.id);
      const [orderItem] = await this.db
        .select({ id: groceryOrderItems.id, productId: groceryOrderItems.productId })
        .from(groceryOrderItems)
        .where(inArray(groceryOrderItems.productId, prodIds))
        .limit(1);

      if (orderItem) {
        const linkedProd = allProducts.find((p) => p.id === orderItem.productId);
        throw new ConflictException(
          `Cannot delete category "${cat.name}" because product "${linkedProd?.name ?? orderItem.productId}" is linked to existing customer orders. Please set products to inactive instead.`,
        );
      }

      // Disassociate product suggestions pointing to these products
      await this.db
        .update(productSuggestions)
        .set({ productId: null })
        .where(inArray(productSuggestions.productId, prodIds));

      // Disassociate template product links
      await this.db
        .update(products)
        .set({ templateProductId: null })
        .where(inArray(products.templateProductId, prodIds));

      // Disassociate vendor discounts referencing these products
      await this.db
        .update(vendorDiscounts)
        .set({ productId: null })
        .where(inArray(vendorDiscounts.productId, prodIds));

      // Delete vendor product listings for these products
      await this.db
        .delete(vendorProducts)
        .where(inArray(vendorProducts.productId, prodIds));

      // Delete the products
      await this.db
        .delete(products)
        .where(inArray(products.id, prodIds));
    }

    // 3. Detach stores from categories: vendor-owned products pointing to these categories
    // move to store's own category copy; vendor subcategories lose this parent
    await this.detachStoresFromCategories([cat, ...subcats]);

    // 4. Clean up any category suggestions referencing this category or its subcategories
    await this.db
      .update(categorySuggestions)
      .set({ categoryId: null })
      .where(inArray(categorySuggestions.categoryId, allCatIds));

    // 5. Clean up any product suggestions referencing this category or its subcategories
    await this.db
      .delete(productSuggestions)
      .where(inArray(productSuggestions.categoryId, allCatIds));

    // 6. Delete subcategories if any
    if (subcats.length > 0) {
      await this.db
        .delete(categories)
        .where(inArray(categories.id, subcats.map((s) => s.id)));
    }

    // 7. Delete the category itself
    await this.db.delete(categories).where(eq(categories.id, id));
    return {
      success: true,
      message: `Category "${cat.name}", ${subcats.length} subcategories, and ${allProducts.length} products deleted successfully.`,
    };
  }

  // Before Laoji categories are deleted: a store's own products filed right
  // under one move to the store's own category of that name (its existing
  // copy, or a new one), and the stores' categories under them lose that
  // parent. Stores' copies simply stop pointing at the template (FK set null).
  private async detachStoresFromCategories(deleted: Category[]) {
    const deletedIds = deleted.map((c) => c.id);
    const stranded = await this.db
      .selectDistinct({ vendorId: products.ownerVendorId, categoryId: products.categoryId })
      .from(products)
      .where(and(inArray(products.categoryId, deletedIds), sql`${products.ownerVendorId} is not null`));
    if (stranded.length > 0) {
      const { byId } = await this.categoryIndex();
      for (const { vendorId, categoryId } of stranded) {
        const template = deleted.find((c) => c.id === categoryId)!;
        let [copy] = await this.db
          .select()
          .from(categories)
          .where(and(eq(categories.ownerVendorId, vendorId!), eq(categories.templateCategoryId, categoryId)))
          .limit(1);
        if (!copy) {
          [copy] = await this.db
            .insert(categories)
            .values({
              name: template.name,
              imageUrl: template.imageUrl,
              parentId: template.parentId && !deletedIds.includes(template.parentId) ? template.parentId : null,
              businessType: categoryBusinessType(template, byId),
              ownerVendorId: vendorId,
            })
            .returning();
        }
        await this.db
          .update(products)
          .set({ categoryId: copy.id })
          .where(and(eq(products.ownerVendorId, vendorId!), eq(products.categoryId, categoryId)));
      }
    }
    await this.db
      .update(categories)
      .set({ parentId: null })
      .where(and(inArray(categories.parentId, deletedIds), sql`${categories.ownerVendorId} is not null`));
  }

  // ---------- Admin + Vendor: Laoji's product catalog (the templates) ----------

  // Laoji's live products. Vendors' own products are theirs, not templates.
  listProducts(categoryId?: string) {
    return this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.status, 'active'),
          isNull(products.ownerVendorId),
          categoryId ? eq(products.categoryId, categoryId) : undefined,
        ),
      );
  }

  async getProduct(id: string) {
    const [row] = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!row) throw new NotFoundException('Product not found');
    return row;
  }

  async createProduct(
    dto: CreateProductDto & {
      attributes?: Record<string, string | number | boolean> | null;
      ownerVendorId?: string | null;
    },
  ) {
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
      ...(dto.mrp !== undefined ? { mrp: dto.mrp ?? null } : {}),
      ...(dto.wholesalePrice !== undefined ? { wholesalePrice: dto.wholesalePrice ?? null } : {}),
      ...(dto.sellingPrice !== undefined ? { sellingPrice: dto.sellingPrice ?? null } : {}),
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

    // 3. A Laoji product is only a template to the stores that stock it: each
    // keeps selling it as its own copy. Any other product's listings go.
    const listings = await this.db.select().from(vendorProducts).where(eq(vendorProducts.productId, id));
    if (prod.ownerVendorId === null) {
      for (const listing of listings) {
        const copies = await this.ownCategoryCopies(listing.vendorId);
        const copy = await this.copyProductForStore(listing.vendorId, prod, {}, shopCategoryId(prod.categoryId, copies));
        await this.db.update(vendorProducts).set({ productId: copy.id }).where(eq(vendorProducts.id, listing.id));
      }
    } else if (listings.length > 0) {
      await this.db.delete(vendorProducts).where(eq(vendorProducts.productId, id));
    }

    // 4. Delete the product
    await this.db.delete(products).where(eq(products.id, id));
    return { success: true, message: `Product "${prod.name}" deleted successfully.` };
  }

  // ---------- Vendor: its store's categories ----------

  // Every category once, with lookups. The table is small (single-city MVP),
  // same "fetch rows, compute in JS" style as the rest of this service.
  private async categoryIndex() {
    const all = await this.listCategoriesFlat();
    return { all, byId: new Map(all.map((c) => [c.id, c])) };
  }

  // The vendor's own copies of Laoji categories, keyed by the Laoji category.
  private async ownCategoryCopies(vendorId: string) {
    const own = await this.db.select().from(categories).where(eq(categories.ownerVendorId, vendorId));
    return ownCopiesByTemplate(own, vendorId);
  }

  // How one vendor sees the category tree.
  private async vendorCategories(vendor: VendorRef) {
    const { all, byId } = await this.categoryIndex();
    const copies = ownCopiesByTemplate(all, vendor.id);
    return {
      all,
      byId,
      copies,
      // Where a product filed under `categoryId` shows in this store.
      shopKey: (categoryId: string) => shopCategoryId(categoryId, copies),
      // A Laoji category offered to this store's business type.
      isTemplateFor: (c: Category) =>
        c.ownerVendorId === null && isCategoryVisibleTo(categoryBusinessType(c, byId), vendor.businessType),
      // A category the vendor may file its own products under (one of its
      // own or any of Laoji's), as the store's category for it.
      usable: (categoryId: string) => {
        const c = byId.get(categoryId);
        if (!c || (c.ownerVendorId !== null && c.ownerVendorId !== vendor.id)) {
          throw new NotFoundException('Category not found');
        }
        return shopCategoryId(c.id, copies);
      },
    };
  }

  // The vendor's store categories and the Laoji categories it can add:
  //  - its own categories (`isOwn`), always in its store;
  //  - Laoji categories it stocks products in but has no copy of (`inShop`:
  //    the store shows them under Laoji's name until it renames one);
  //  - the rest of Laoji's leaf categories for its business type, as
  //    templates (`inShop` false).
  // A Laoji category the store has its own copy of is left out, since its
  // products show under the copy. `productCount` counts the store's listings.
  async listVendorCategories(vendor: VendorRef) {
    const [scope, listed] = await Promise.all([
      this.vendorCategories(vendor),
      this.db
        .select({ categoryId: products.categoryId })
        .from(vendorProducts)
        .innerJoin(products, eq(vendorProducts.productId, products.id))
        .where(eq(vendorProducts.vendorId, vendor.id)),
    ]);
    const counts = new Map<string, number>();
    for (const { categoryId } of listed) {
      const key = scope.shopKey(categoryId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const parentIds = new Set(scope.all.map((c) => c.parentId));
    const view = (c: Category, isOwn: boolean) => {
      const productCount = counts.get(c.id) ?? 0;
      return { ...c, isOwn, inShop: isOwn || productCount > 0, productCount };
    };
    const own = scope.all.filter((c) => c.ownerVendorId === vendor.id).map((c) => view(c, true));
    const laoji = scope.all
      .filter(
        (c) =>
          c.ownerVendorId === null &&
          !scope.copies.has(c.id) &&
          (counts.has(c.id) || (scope.isTemplateFor(c) && !parentIds.has(c.id))),
      )
      .map((c) => view(c, false));
    return [...own, ...laoji].sort((a, b) => Number(b.inShop) - Number(a.inShop) || a.name.localeCompare(b.name));
  }

  // The Laoji root a business type's store categories are filed under, so
  // the tree stays root → subcategory like Laoji's (created on first use).
  private async businessTypeRoot(businessType: string) {
    const rootName = BUSINESS_TYPE_ROOT_CATEGORY[businessType];
    if (!rootName) {
      throw new BadRequestException('Restaurants manage menu categories from the menu screen');
    }
    let [root] = await this.db
      .select()
      .from(categories)
      .where(
        and(
          isNull(categories.parentId),
          isNull(categories.ownerVendorId),
          eq(categories.businessType, businessType),
          ilike(categories.name, rootName),
        ),
      )
      .limit(1);
    if (!root) {
      [root] = await this.db.insert(categories).values({ name: rootName, businessType }).returning();
    }
    return root;
  }

  // A category of the vendor's own store: its copy of a Laoji category
  // (`templateCategoryId`, or a new name matching one of Laoji's categories
  // for its business type, so customers still find the products under
  // Laoji's), or one of its own. A name the store already has returns that
  // category instead of a duplicate.
  async createVendorCategory(vendor: VendorRef, dto: { name?: string; templateCategoryId?: string }) {
    if (!BUSINESS_TYPE_ROOT_CATEGORY[vendor.businessType]) {
      throw new BadRequestException('Restaurants manage menu categories from the menu screen');
    }
    const scope = await this.vendorCategories(vendor);
    let template: Category | undefined;
    if (dto.templateCategoryId) {
      template = scope.byId.get(dto.templateCategoryId);
      if (!template || template.ownerVendorId !== null) throw new NotFoundException('Category not found');
      const copy = scope.copies.get(template.id);
      if (copy) return copy;
    }
    const name = (dto.name ?? template?.name ?? '').trim();
    if (!name) throw new BadRequestException('Category name is required');

    const existing = scope.all.find((c) => c.ownerVendorId === vendor.id && sameName(c.name, name));
    if (existing) {
      if (!template || existing.templateCategoryId === template.id) return existing;
      if (existing.templateCategoryId) {
        throw new ConflictException(`Your store already has a category named "${name}"`);
      }
      // The store's own category of that name becomes its copy of Laoji's.
      const [linked] = await this.db
        .update(categories)
        .set({ templateCategoryId: template.id })
        .where(eq(categories.id, existing.id))
        .returning();
      await this.moveOwnProducts(vendor.id, template.id, linked.id);
      return linked;
    }

    if (!template) {
      const parentIds = new Set(scope.all.map((c) => c.parentId));
      template = scope.all.find(
        (c) => scope.isTemplateFor(c) && !parentIds.has(c.id) && !scope.copies.has(c.id) && sameName(c.name, name),
      );
    }
    const [created] = await this.db
      .insert(categories)
      .values(
        template
          ? {
              name,
              parentId: template.parentId,
              imageUrl: template.imageUrl,
              businessType: categoryBusinessType(template, scope.byId),
              ownerVendorId: vendor.id,
              templateCategoryId: template.id,
            }
          : {
              name,
              parentId: (await this.businessTypeRoot(vendor.businessType)).id,
              businessType: vendor.businessType,
              ownerVendorId: vendor.id,
            },
      )
      .returning();
    // The store's own products filed under Laoji's category now sit in its copy.
    if (template) await this.moveOwnProducts(vendor.id, template.id, created.id);
    return created;
  }

  private moveOwnProducts(vendorId: string, fromCategoryId: string, toCategoryId: string) {
    return this.db
      .update(products)
      .set({ categoryId: toCategoryId })
      .where(and(eq(products.ownerVendorId, vendorId), eq(products.categoryId, fromCategoryId)));
  }

  // Renames a category in the vendor's store only. Renaming one of Laoji's
  // gives the store its own copy under the new name; Laoji's keeps its name.
  async renameVendorCategory(vendor: VendorRef, id: string, name: string) {
    const scope = await this.vendorCategories(vendor);
    const category = scope.byId.get(id);
    if (!category || (category.ownerVendorId !== null && category.ownerVendorId !== vendor.id)) {
      throw new NotFoundException('Category not found');
    }
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Category name is required');
    const target = category.ownerVendorId === null ? scope.copies.get(category.id) : category;
    if (!target) return this.createVendorCategory(vendor, { templateCategoryId: category.id, name: trimmed });

    const clash = scope.all.find(
      (c) => c.ownerVendorId === vendor.id && c.id !== target.id && sameName(c.name, trimmed),
    );
    if (clash) throw new ConflictException(`Your store already has a category named "${trimmed}"`);
    const [updated] = await this.db
      .update(categories)
      .set({ name: trimmed })
      .where(eq(categories.id, target.id))
      .returning();
    return updated;
  }

  // Removes one of the vendor's own categories once none of its store's
  // products is in it. A store can't delete Laoji's categories.
  async deleteVendorCategory(vendor: VendorRef, id: string) {
    const scope = await this.vendorCategories(vendor);
    const category = scope.byId.get(id);
    if (!category || (category.ownerVendorId !== null && category.ownerVendorId !== vendor.id)) {
      throw new NotFoundException('Category not found');
    }
    if (category.ownerVendorId === null) {
      throw new ForbiddenException(
        `"${category.name}" is a Laoji category, so it can't be deleted. You can rename it for your store.`,
      );
    }
    const listed = await this.db
      .select({ categoryId: products.categoryId })
      .from(vendorProducts)
      .innerJoin(products, eq(vendorProducts.productId, products.id))
      .where(eq(vendorProducts.vendorId, vendor.id));
    const count = listed.filter((l) => scope.shopKey(l.categoryId) === category.id).length;
    if (count > 0) {
      throw new ConflictException(
        `"${category.name}" still has ${count} ${count === 1 ? 'product' : 'products'}. Move ${count === 1 ? 'it' : 'them'} to another category or remove ${count === 1 ? 'it' : 'them'} from your store first.`,
      );
    }
    // Anything left in it is the store's own products kept only for past
    // orders; they move to the Laoji category it came from, or the root.
    const fallback =
      category.templateCategoryId ?? category.parentId ?? (await this.businessTypeRoot(vendor.businessType)).id;
    await this.db.update(products).set({ categoryId: fallback }).where(eq(products.categoryId, category.id));
    await this.db.delete(categories).where(eq(categories.id, category.id));
    return { success: true, message: `Category "${category.name}" deleted.` };
  }

  // ---------- Vendor: products in its store ----------

  // Laoji's products as a vendor picks from them (templates): live ones in
  // its business type's categories, so a clothing store isn't shown
  // groceries. `categoryId` may be one of the store's own copies of a Laoji
  // category. `listingId` is the store's listing when it already stocks the
  // product (or its own copy of it), so the app opens that instead of adding
  // it twice.
  async listVendorCatalogProducts(vendor: VendorRef, categoryId?: string) {
    const scope = await this.vendorCategories(vendor);
    const filterCategory = categoryId ? scope.byId.get(categoryId) : undefined;
    const filterId = filterCategory?.ownerVendorId === vendor.id ? filterCategory.templateCategoryId : categoryId;
    // One of the store's own categories that isn't a Laoji copy: nothing of Laoji's is in it.
    if (categoryId && !filterId) return [];

    const [rows, listings] = await Promise.all([
      this.listProducts(filterId ?? undefined),
      this.db
        .select({
          id: vendorProducts.id,
          productId: vendorProducts.productId,
          templateProductId: products.templateProductId,
        })
        .from(vendorProducts)
        .innerJoin(products, eq(vendorProducts.productId, products.id))
        .where(eq(vendorProducts.vendorId, vendor.id)),
    ]);
    const listingIdByProduct = new Map<string, string>();
    for (const l of listings) {
      listingIdByProduct.set(l.productId, l.id);
      if (l.templateProductId) listingIdByProduct.set(l.templateProductId, l.id);
    }
    return rows
      .filter((p) => {
        const category = scope.byId.get(p.categoryId);
        return category !== undefined && scope.isTemplateFor(category);
      })
      .map((p) => ({
        ...p,
        categoryName: scope.byId.get(p.categoryId)?.name ?? null,
        listingId: listingIdByProduct.get(p.id) ?? null,
      }));
  }

  // The vendor's listings, each with its product as the store shows it:
  // `product.categoryId` is the store's category for it (its own copy of the
  // Laoji category when it has one). `isOwnProduct` marks the store's own
  // products; the others are Laoji's, shared with every store that stocks
  // them until this one changes their details.
  async listVendorProducts(vendorId: string) {
    const [rows, copies, vendorCommissionPct] = await Promise.all([
      this.db
        .select({ vendorProduct: vendorProducts, product: products })
        .from(vendorProducts)
        .innerJoin(products, eq(vendorProducts.productId, products.id))
        .where(eq(vendorProducts.vendorId, vendorId)),
      this.ownCategoryCopies(vendorId),
      this.resolveVendorCommissionPct(vendorId),
    ]);
    return rows.map((r) => this.listingView(vendorId, r.vendorProduct, r.product, copies, vendorCommissionPct));
  }

  private listingView(
    vendorId: string,
    listing: Listing,
    product: Product,
    copies: Map<string, { id: string }>,
    vendorCommissionPct?: number,
  ) {
    return {
      ...listing,
      commissionPct: (listing as any).commissionPct != null ? (listing as any).commissionPct : vendorCommissionPct,
      product: { ...product, categoryId: shopCategoryId(product.categoryId, copies) },
      isOwnProduct: product.ownerVendorId === vendorId,
    };
  }

  private async listingResponse(vendorId: string, listing: Listing, product: Product) {
    const vendorCommissionPct = await this.resolveVendorCommissionPct(vendorId);
    return this.listingView(vendorId, listing, product, await this.ownCategoryCopies(vendorId), vendorCommissionPct);
  }

  // What a vendor may start stocking: a live Laoji product in its business
  // type's categories, or a product of its own.
  private async assertListableBy(vendor: VendorRef, product: Product) {
    if (product.ownerVendorId === vendor.id) return;
    if (product.ownerVendorId !== null) throw new ForbiddenException('This product belongs to another store');
    if (product.status !== 'active') {
      throw new BadRequestException(`"${product.name}" is no longer available in the catalog`);
    }
    const { byId } = await this.categoryIndex();
    const category = byId.get(product.categoryId);
    if (!category || !isCategoryVisibleTo(categoryBusinessType(category, byId), vendor.businessType)) {
      throw new BadRequestException(`"${product.name}" is not in your store type's catalog`);
    }
  }

  // The vendor's listing of a product: of the product itself, or of the
  // store's own copy of it when it is one of Laoji's.
  private async findListingOf(vendorId: string, product: Product) {
    const [row] = await this.db
      .select({ listing: vendorProducts })
      .from(vendorProducts)
      .innerJoin(products, eq(vendorProducts.productId, products.id))
      .where(
        and(
          eq(vendorProducts.vendorId, vendorId),
          or(
            eq(vendorProducts.productId, product.id),
            and(eq(products.templateProductId, product.id), eq(products.ownerVendorId, vendorId)),
          ),
        ),
      )
      .limit(1);
    return row?.listing;
  }

  // The product a listing should point at once the vendor's details are
  // applied. The store's own product is updated in place. A Laoji product
  // stays shared with every store that stocks it while the vendor keeps its
  // details; once the vendor changes any, the store gets its own copy with
  // the changes and Laoji's product stays as it was.
  private async productForListing(vendor: VendorRef, product: Product, input: VendorProductDetailsDto) {
    if (product.ownerVendorId !== null && product.ownerVendorId !== vendor.id) {
      throw new ForbiddenException('This product belongs to another store');
    }
    const scope = await this.vendorCategories(vendor);
    const details: ProductDetailInput = {
      ...input,
      categoryId: input.categoryId !== undefined ? scope.usable(input.categoryId) : undefined,
      attributes:
        input.attributes !== undefined && vendor.businessType !== 'restaurant'
          ? // Only what was filled in is checked: a Laoji product wasn't made with the form.
            readProductAttributes(
              productFormFor(vendor.businessType),
              { name: product.name, unit: product.unit, attributes: input.attributes },
              { requireAll: false },
            )
          : undefined,
    };
    const currentShopCategory = scope.shopKey(product.categoryId);
    const changes = productDetailChanges(product, details, (id) => id === currentShopCategory);
    if (Object.keys(changes).length === 0) return product;
    if (product.ownerVendorId === vendor.id) {
      const [updated] = await this.db.update(products).set(changes).where(eq(products.id, product.id)).returning();
      return updated;
    }
    return this.copyProductForStore(vendor.id, product, changes, currentShopCategory);
  }

  // A store's own copy of a Laoji product, with its changes; the copy keeps
  // a link to the product it came from.
  private async copyProductForStore(
    vendorId: string,
    template: Product,
    changes: Partial<typeof products.$inferInsert>,
    categoryId: string,
  ) {
    const [copy] = await this.db
      .insert(products)
      .values({
        categoryId,
        brand: template.brand,
        name: template.name,
        description: template.description,
        unit: template.unit,
        size: template.size,
        mrp: template.mrp,
        wholesalePrice: template.wholesalePrice,
        sellingPrice: template.sellingPrice,
        imageUrl: template.imageUrl,
        attributes: template.attributes,
        status: template.status,
        ...changes,
        ownerVendorId: vendorId,
        templateProductId: template.id,
      })
      .returning();
    return copy;
  }

  // A restock date only means something while a listing can't be sold; once
  // it has stock and is available again, the date is dropped.
  private normalizeRestockEta(listing: { stockQty: number; isAvailable: boolean; restockEta: string | null }) {
    return listing.stockQty > 0 && listing.isAvailable ? null : listing.restockEta;
  }

  private assertRestockEtaNotPast(restockEta: string | null | undefined) {
    if (restockEta && restockEta < istDateString()) {
      throw new BadRequestException('Restock date cannot be in the past');
    }
  }

  // Adds a product to the vendor's store with its own price and stock — a
  // Laoji product, with any details the vendor changed going to its own copy
  // (see productForListing), or one of its own — or updates the listing the
  // store already has for it.
  async upsertVendorProduct(vendor: VendorRef, dto: UpsertVendorProductDto) {
    const product = await this.getProduct(dto.productId);
    const existing = await this.findListingOf(vendor.id, product);
    if (existing) return this.updateVendorProduct(vendor, existing.id, dto);

    this.assertRestockEtaNotPast(dto.restockEta);
    await this.assertListableBy(vendor, product);
    const listed = await this.productForListing(vendor, product, dto);
    const isAvailable = dto.isAvailable ?? true;
    const [created] = await this.db
      .insert(vendorProducts)
      .values({
        vendorId: vendor.id,
        productId: listed.id,
        price: dto.price,
        wholesalePrice: dto.wholesalePrice !== undefined ? dto.wholesalePrice : listed.wholesalePrice,
        stockQty: dto.stockQty,
        isAvailable,
        offerTag: dto.offerTag || null,
        lowStockThreshold: dto.lowStockThreshold,
        restockEta: this.normalizeRestockEta({ stockQty: dto.stockQty, isAvailable, restockEta: dto.restockEta ?? null }),
        lastRestockedAt: dto.stockQty > 0 ? new Date() : null,
      })
      .returning();
    return this.listingResponse(vendor.id, created, listed);
  }

  // A product the vendor creates from scratch for its own store.
  async createVendorProduct(vendor: VendorRef, dto: CreateGroceryProductDto) {
    this.assertRestockEtaNotPast(dto.restockEta);
    const scope = await this.vendorCategories(vendor);
    const categoryId = scope.usable(dto.categoryId);
    const attributes =
      dto.attributes === undefined
        ? null
        : normalizeAttributes(
            readProductAttributes(productFormFor(vendor.businessType), { ...dto, attributes: dto.attributes }),
          );
    const product = await this.createProduct({
      categoryId,
      name: dto.name.trim(),
      brand: dto.brand?.trim() || undefined,
      unit: dto.unit.trim(),
      size: dto.size?.trim() || undefined,
      mrp: dto.mrp,
      wholesalePrice: dto.wholesalePrice,
      sellingPrice: dto.price,
      imageUrl: dto.imageUrl || undefined,
      description: dto.description?.trim() || undefined,
      attributes,
      ownerVendorId: vendor.id,
    });

    const isAvailable = dto.isAvailable ?? true;
    const [listing] = await this.db
      .insert(vendorProducts)
      .values({
        vendorId: vendor.id,
        productId: product.id,
        price: dto.price,
        wholesalePrice: dto.wholesalePrice,
        stockQty: dto.stockQty,
        isAvailable,
        offerTag: dto.offerTag || null,
        lowStockThreshold: dto.lowStockThreshold,
        restockEta: this.normalizeRestockEta({ stockQty: dto.stockQty, isAvailable, restockEta: dto.restockEta ?? null }),
        lastRestockedAt: dto.stockQty > 0 ? new Date() : null,
      })
      .returning();
    return this.listingResponse(vendor.id, listing, product);
  }

  private async requireOwnVendorProduct(vendorId: string, id: string) {
    const [row] = await this.db.select().from(vendorProducts).where(eq(vendorProducts.id, id)).limit(1);
    if (!row) throw new NotFoundException('Listing not found');
    if (row.vendorId !== vendorId) throw new ForbiddenException('Not your listing');
    return row;
  }

  // Listing terms (price, stock, availability, restock date, offer) and, when
  // sent, product details: on the store's own product they change it, on a
  // Laoji product they move the listing to the store's own copy (see
  // productForListing). App builds up to 1.0.2 resend every detail on each
  // edit; details sent back unchanged never make a copy.
  async updateVendorProduct(vendor: VendorRef, id: string, dto: UpdateVendorProductDto) {
    const existing = await this.requireOwnVendorProduct(vendor.id, id);
    this.assertRestockEtaNotPast(dto.restockEta);
    const product = await this.productForListing(vendor, await this.getProduct(existing.productId), dto);

    const stockQty = dto.stockQty ?? existing.stockQty;
    const isAvailable = dto.isAvailable ?? existing.isAvailable;
    const restockEta = dto.restockEta !== undefined ? dto.restockEta : existing.restockEta;
    const [updated] = await this.db
      .update(vendorProducts)
      .set({
        ...(product.id !== existing.productId ? { productId: product.id } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.wholesalePrice !== undefined ? { wholesalePrice: dto.wholesalePrice } : {}),
        stockQty,
        isAvailable,
        ...(dto.offerTag !== undefined ? { offerTag: dto.offerTag || null } : {}),
        ...(dto.lowStockThreshold !== undefined ? { lowStockThreshold: dto.lowStockThreshold } : {}),
        restockEta: this.normalizeRestockEta({ stockQty, isAvailable, restockEta }),
        ...(stockQty > existing.stockQty ? { lastRestockedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(vendorProducts.id, id))
      .returning();

    return this.listingResponse(vendor.id, updated, product);
  }

  // Adds received units on top of current stock (a SQL increment, so it
  // can't lose a concurrent edit) and puts the listing back on sale.
  async restockVendorProduct(vendorId: string, id: string, qty: number) {
    await this.requireOwnVendorProduct(vendorId, id);
    const [updated] = await this.db
      .update(vendorProducts)
      .set({
        stockQty: sql`${vendorProducts.stockQty} + ${qty}`,
        isAvailable: true,
        restockEta: null,
        lastRestockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(vendorProducts.id, id))
      .returning();
    const product = await this.getProduct(updated.productId);
    return this.listingResponse(vendorId, updated, product);
  }

  // Takes the listing off the vendor's store. A product of the store's own
  // (made from scratch or copied from Laoji's) goes with it once no order
  // refers to it; a Laoji product stays, since other stores stock it and
  // this one can add it back later.
  async deleteVendorProduct(vendorId: string, id: string) {
    const row = await this.requireOwnVendorProduct(vendorId, id);
    await this.db.delete(vendorProducts).where(eq(vendorProducts.id, id));

    const product = await this.getProduct(row.productId);
    if (product.ownerVendorId === vendorId) {
      const [orderItem] = await this.db
        .select({ id: groceryOrderItems.id })
        .from(groceryOrderItems)
        .where(eq(groceryOrderItems.productId, product.id))
        .limit(1);
      if (!orderItem) await this.db.delete(products).where(eq(products.id, product.id));
    }
    return { success: true };
  }

  async createVendorCustomProduct(vendor: VendorRef, dto: CreateVendorCustomProductDto) {
    const scope = await this.vendorCategories(vendor);
    const stockQty = dto.stockQty ?? 0;
    const [product] = await this.db
      .insert(products)
      .values({
        categoryId: scope.usable(dto.categoryId),
        brand: dto.brand || null,
        name: dto.name,
        description: dto.description || null,
        unit: dto.unit,
        size: dto.size || null,
        mrp: dto.mrp ?? null,
        imageUrl: dto.imageUrl || null,
        status: 'active',
        ownerVendorId: vendor.id,
      })
      .returning();

    const [listing] = await this.db
      .insert(vendorProducts)
      .values({
        vendorId: vendor.id,
        productId: product.id,
        price: dto.price,
        stockQty,
        isAvailable: dto.isAvailable ?? true,
        lastRestockedAt: stockQty > 0 ? new Date() : null,
      })
      .returning();

    return this.listingResponse(vendor.id, listing, product);
  }

  private async requireListingOfProduct(vendorId: string, productId: string) {
    const [listing] = await this.db
      .select()
      .from(vendorProducts)
      .where(and(eq(vendorProducts.vendorId, vendorId), eq(vendorProducts.productId, productId)))
      .limit(1);
    if (!listing) throw new NotFoundException('Product listing not found');
    return listing;
  }

  async updateVendorCustomProduct(vendor: VendorRef, productId: string, dto: UpdateVendorCustomProductDto) {
    const listing = await this.requireListingOfProduct(vendor.id, productId);
    return this.updateVendorProduct(vendor, listing.id, dto);
  }

  async deleteVendorCustomProduct(vendorId: string, productId: string) {
    const listing = await this.requireListingOfProduct(vendorId, productId);
    return this.deleteVendorProduct(vendorId, listing.id);
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
      (v) => (v.showInApp !== false) && haversineKm(lat, lng, v.pickupLat, v.pickupLng) <= v.radiusKm,
    );
  }

  async publicListProducts(lat: number, lng: number, categoryId?: string) {
    const inRadius = await this.vendorsInRadius(lat, lng);
    const vendorIds = inRadius.map((v) => v.id);
    if (vendorIds.length === 0) return [];

    const { all, byId } = await this.categoryIndex();
    let categoryIds: string[] | undefined = undefined;
    if (categoryId) {
      const catIdSet = new Set<string>([categoryId]);
      const addChildren = (pId: string) => {
        for (const c of all) {
          if (c.parentId === pId && !catIdSet.has(c.id)) {
            catIdSet.add(c.id);
            addChildren(c.id);
          }
        }
      };
      addChildren(categoryId);
      // A Laoji category also holds what stores filed under their own copies of it.
      for (const c of all) {
        if (c.ownerVendorId !== null && c.templateCategoryId && catIdSet.has(c.templateCategoryId)) {
          catIdSet.add(c.id);
        }
      }
      categoryIds = Array.from(catIdSet);
    }

    const rows = await this.db
      .select({ vendorProduct: vendorProducts, product: products })
      .from(vendorProducts)
      .innerJoin(products, eq(vendorProducts.productId, products.id))
      .where(
        and(
          inArray(vendorProducts.vendorId, vendorIds),
          eq(vendorProducts.isAvailable, true),
          eq(products.status, 'active'),
          categoryIds ? inArray(products.categoryId, categoryIds) : undefined,
        ),
      );

    return await this.aggregateByProduct(rows, byId);
  }

  // The category a product counts under for customers and revenue rules: a
  // store's copy of a Laoji category counts as that Laoji category.
  async customerCategoryId(categoryId: string) {
    const { byId } = await this.categoryIndex();
    return laojiCategoryId(categoryId, byId);
  }

  async publicGetProduct(id: string, lat: number, lng: number) {
    const product = await this.getProduct(id);
    const { byId } = await this.categoryIndex();
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

    const [aggregated] = await this.aggregateByProduct(rows, byId);
    return {
      ...product,
      categoryId: laojiCategoryId(product.categoryId, byId),
      price: aggregated?.price ?? null,
      mrp: aggregated?.mrp ?? product.mrp ?? null,
      offerTag: aggregated?.offerTag ?? null,
      inStock: aggregated?.inStock ?? false,
      restockEta: aggregated?.restockEta ?? null,
    };
  }

  // One entry per product across every in-radius vendor listing it. The price
  // is the cheapest vendor that has it in stock (the cheapest overall if none
  // do); when none do, `restockEta` is the soonest date one expects it back.
  // `categoryId` is the one customers browse by (see laojiCategoryId).
  private async aggregateByProduct(
    rows: { vendorProduct: typeof vendorProducts.$inferSelect; product: typeof products.$inferSelect }[],
    categoriesById: Map<string, Category>,
  ) {
    const today = istDateString();
    const vendorIds = Array.from(new Set(rows.map((r) => r.vendorProduct.vendorId)));
    const discountsByVendor = new Map<string, any[]>();
    await Promise.all(
      vendorIds.map(async (vId) => {
        const d = await this.vendorDiscounts.getActiveDiscountsForVendor(vId);
        discountsByVendor.set(vId, d);
      }),
    );

    const byProduct = new Map<
      string,
      {
        product: typeof products.$inferSelect;
        price: number;
        originalPrice: number;
        mrp: number | null;
        offerTag: string | null;
        inStock: boolean;
        restockEta: string | null;
      }
    >();
    for (const { vendorProduct, product } of rows) {
      const vDiscounts = discountsByVendor.get(vendorProduct.vendorId) || [];
      const disc = this.vendorDiscounts.calculateItemDiscount(vendorProduct.price, vDiscounts, { productId: product.id });
      const inStock = vendorProduct.stockQty > 0;
      const eta = !inStock && vendorProduct.restockEta && vendorProduct.restockEta >= today ? vendorProduct.restockEta : null;
      const current = byProduct.get(product.id);
      if (!current) {
        byProduct.set(product.id, {
          product,
          price: disc.price,
          originalPrice: disc.originalPrice,
          mrp: product.mrp || (disc.discountApplied ? disc.originalPrice : null),
          offerTag: disc.discountLabel || (product.attributes?.offerTag as string | null) || null,
          inStock,
          restockEta: eta,
        });
        continue;
      }
      current.inStock ||= inStock;
      if (eta && (!current.restockEta || eta < current.restockEta)) current.restockEta = eta;
    }
    return [...byProduct.values()].map(({ product, price, mrp, offerTag, inStock, restockEta }) => ({
      ...product,
      categoryId: laojiCategoryId(product.categoryId, categoriesById),
      price,
      mrp: mrp || product.mrp,
      offerTag: offerTag || null,
      inStock,
      restockEta: inStock ? null : restockEta,
    }));
  }

  // ---------- Public: customer browse (restaurants + menu) ----------

  // Restaurants whose delivery radius covers (lat, lng), open ones first and
  // nearest first within each group.
  async publicListRestaurants(lat: number, lng: number) {
    const allVendors = await this.db.select().from(vendors);
    const distanceKm = new Map(allVendors.map((v) => [v.id, haversineKm(lat, lng, v.pickupLat, v.pickupLng)]));
    // Filter strictly by showInApp and service radius — do not drop closed vendors,
    // customer app needs to show closed vendors as closed (with timing / ordering).
    // Do not filter out grocery vendors — customer app lists all local stores/restaurants here.
    const nearbyVendors = allVendors.filter(
      (v) => (v.showInApp !== false) && distanceKm.get(v.id)! <= v.radiusKm,
    );
    if (nearbyVendors.length === 0) return [];
    const vendorMap = new Map(nearbyVendors.map((v) => [v.id, v]));
    const vendorIds = nearbyVendors.map((v) => v.id);

    let rows = await this.db
      .select()
      .from(restaurants)
      .where(inArray(restaurants.vendorId, vendorIds));

    // Ensure every nearby vendor has a restaurant/store record represented
    const existingVendorIds = new Set(rows.map((r) => r.vendorId));
    for (const v of nearbyVendors) {
      if (!existingVendorIds.has(v.id)) {
        try {
          const [newRest] = await this.db
            .insert(restaurants)
            .values({
              vendorId: v.id,
              name: v.businessName,
              imageUrl: v.imageUrl,
            })
            .returning();
          if (newRest) rows.push(newRest);
        } catch {
          // ignore potential race condition
        }
      }
    }

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

    return rows
      .map((r) => {
        const v = vendorMap.get(r.vendorId);
        const openNow = (v?.isOpen ?? false) && (v ? isVendorOpenNow(v) : false);
        const agg = ratingsMap.get(r.id);
        const dynamicRating = agg && agg.count > 0 ? agg.avg : (r.ratingAvg > 0 ? Math.round(r.ratingAvg * 10) / 10 : 4.8);
        const dynamicCount = agg ? agg.count : 0;
        return {
          ...r,
          mealTimings: mealTimingsView(r.mealTimings),
          imageUrl: r.imageUrl || v?.imageUrl || null,
          ratingAvg: dynamicRating,
          ratingCount: dynamicCount,
          isOpen: openNow,
          type: v?.type || 'restaurant',
          displayOrder: v?.displayOrder ?? 0,
          distanceKm: roundKm(distanceKm.get(r.vendorId)!),
        };
      })
      .sort((a, b) => {
        const orderA = vendorMap.get(a.vendorId)?.displayOrder ?? 9999;
        const orderB = vendorMap.get(b.vendorId)?.displayOrder ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return Number(b.isOpen) - Number(a.isOpen) || a.distanceKm - b.distanceKm;
      });
  }

  // `near` is the customer's location, when the client sends one — adds how
  // far away the restaurant is and whether it delivers there.
  async publicGetRestaurant(id: string, near?: { lat: number; lng: number }) {
    let [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
    if (!restaurant) {
      [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, id)).limit(1);
    }
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, restaurant.vendorId)).limit(1);
    if (!vendor || vendor.showInApp === false) {
      throw new NotFoundException('Store is currently not available');
    }
    const openNow = (vendor?.isOpen ?? false) && (vendor ? isVendorOpenNow(vendor) : false);
    const distanceKm = near && vendor ? haversineKm(near.lat, near.lng, vendor.pickupLat, vendor.pickupLng) : null;
    const timings = effectiveMealTimings(restaurant.mealTimings);
    const now = new Date();

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

    if (cats.length === 0 && vendor) {
      const vProds = await this.db
        .select({
          vp: vendorProducts,
          p: products,
          c: categories,
        })
        .from(vendorProducts)
        .innerJoin(products, eq(vendorProducts.productId, products.id))
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(
          and(
            eq(vendorProducts.vendorId, vendor.id),
            eq(vendorProducts.isAvailable, true),
            eq(products.status, 'active'),
          ),
        );

      if (vProds.length > 0) {
        const vendorDiscounts = await this.vendorDiscounts.getActiveDiscountsForVendor(vendor.id);
        const catMap = new Map<string, { id: string; name: string; items: any[] }>();
        for (const row of vProds) {
          const cId = row.c.id;
          if (!catMap.has(cId)) {
            catMap.set(cId, {
              id: cId,
              name: row.c.name,
              items: [],
            });
          }
          const disc = this.vendorDiscounts.calculateItemDiscount(row.vp.price, vendorDiscounts, { productId: row.p.id });
          catMap.get(cId)!.items.push({
            id: row.p.id,
            menuCategoryId: cId,
            name: row.p.name,
            description: row.p.description,
            price: disc.price,
            originalPrice: disc.originalPrice,
            mrp: row.p.mrp || (disc.discountApplied ? disc.originalPrice : null),
            offerTag: disc.discountLabel,
            imageUrl: row.p.imageUrl,
            isVeg: true,
            isAvailable: row.vp.isAvailable,
            addons: [],
            variants: [],
          });
        }
        return {
          ...restaurant,
          imageUrl: restaurant.imageUrl || vendor?.imageUrl || null,
          ratingAvg: dynamicRating,
          ratingCount: dynamicCount,
          isOpen: openNow,
          menuCategories: Array.from(catMap.values()),
        };
      }
    }

    const vendorDiscounts = vendor ? await this.vendorDiscounts.getActiveDiscountsForVendor(vendor.id) : [];

    return {
      ...restaurant,
      mealTimings: mealTimingsView(restaurant.mealTimings),
      imageUrl: restaurant.imageUrl || vendor?.imageUrl || null,
      ratingAvg: dynamicRating,
      ratingCount: dynamicCount,
      isOpen: openNow,
      ...(distanceKm !== null && vendor
        ? { distanceKm: roundKm(distanceKm), deliversToYou: distanceKm <= vendor.radiusKm }
        : {}),
      menuCategories: cats.map((cat) => ({
        ...cat,
        items: items
          .filter((i) => i.menuCategoryId === cat.id)
          .map((item) => {
            // `isAvailable` here means "orderable right now": the restaurant's
            // own switch and the item's meal slot. `servedNow` tells a client
            // which of the two is keeping it off.
            const servedNow = isServedNow(item.mealSlots, timings, now);
            const disc = this.vendorDiscounts.calculateItemDiscount(item.price, vendorDiscounts, { menuItemId: item.id });
            return {
              ...item,
              price: disc.price,
              originalPrice: disc.originalPrice,
              mrp: disc.discountApplied ? disc.originalPrice : null,
              offerTag: disc.discountLabel,
              mealSlots: item.mealSlots ?? [],
              servedNow,
              isAvailable: item.isAvailable && servedNow,
              addons: addons.filter((a) => a.menuItemId === item.id),
              variants: variants.filter((v) => v.menuItemId === item.id),
            };
          }),
      })),
    };
  }

  // Only what can be ordered at (lat, lng): vendors whose delivery radius
  // covers it and that are open now, and dishes in their meal slot now.
  async publicSearch(lat: number, lng: number, query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      return { products: [], restaurants: [], dishes: [] };
    }

    const inRadius = await this.vendorsInRadius(lat, lng);
    const distanceKm = new Map(inRadius.map((v) => [v.id, haversineKm(lat, lng, v.pickupLat, v.pickupLng)]));
    // A 'both' vendor sells products as well as running a restaurant.
    const productVendorIds = inRadius.filter((v) => v.type !== 'restaurant').map((v) => v.id);
    const restaurantVendorIds = inRadius.filter((v) => v.type !== 'grocery').map((v) => v.id);

    // 1. Matched products
    let productsList: Awaited<ReturnType<CatalogService['aggregateByProduct']>> = [];
    if (productVendorIds.length > 0) {
      const pRows = await this.db
        .select({ vendorProduct: vendorProducts, product: products })
        .from(vendorProducts)
        .innerJoin(products, eq(vendorProducts.productId, products.id))
        .where(
          and(
            inArray(vendorProducts.vendorId, productVendorIds),
            eq(vendorProducts.isAvailable, true),
            eq(products.status, 'active'),
            ilike(products.name, `%${trimmed}%`),
          ),
        );
      productsList = await this.aggregateByProduct(pRows, (await this.categoryIndex()).byId);
    }

    // 2. Matched restaurants, nearest first
    let matchedRestaurants: (Omit<typeof restaurants.$inferSelect, 'mealTimings'> & {
      mealTimings: ReturnType<typeof mealTimingsView>;
      distanceKm: number;
    })[] = [];
    if (restaurantVendorIds.length > 0) {
      const rows = await this.db
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
      matchedRestaurants = rows
        .map((r) => ({
          ...r,
          mealTimings: mealTimingsView(r.mealTimings),
          distanceKm: roundKm(distanceKm.get(r.vendorId)!),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm);
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
          const timingsByRestaurant = new Map(activeRestaurants.map((r) => [r.id, effectiveMealTimings(r.mealTimings)]));
          const now = new Date();

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

          dishesList = itemRows
            .filter((item) =>
              isServedNow(item.mealSlots, timingsByRestaurant.get(catMap.get(item.menuCategoryId)!)!, now),
            )
            .map((item) => {
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
                mealSlots: item.mealSlots ?? [],
              };
            });
        }
      }
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

  async getMealTimings(vendorId: string) {
    const restaurant = await this.getOrCreateRestaurant(vendorId);
    return mealTimingsView(restaurant.mealTimings);
  }

  async updateMealTimings(vendorId: string, dto: UpdateMealTimingsDto) {
    validateMealTimings(dto.timings);
    const restaurant = await this.getOrCreateRestaurant(vendorId);
    const [updated] = await this.db
      .update(restaurants)
      .set({ mealTimings: dto.timings.map(({ slot, start, end }) => ({ slot, start, end })) })
      .where(eq(restaurants.id, restaurant.id))
      .returning();
    return mealTimingsView(updated.mealTimings);
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

    const [items, vendorCommissionPct] = await Promise.all([
      this.db
        .select()
        .from(menuItems)
        .where(
          and(
            inArray(menuItems.menuCategoryId, catIds),
            menuCategoryId ? eq(menuItems.menuCategoryId, menuCategoryId) : undefined,
          ),
        ),
      this.resolveVendorCommissionPct(vendorId),
    ]);
    const itemIds = items.map((i) => i.id);
    const addons = itemIds.length
      ? await this.db.select().from(menuItemAddons).where(inArray(menuItemAddons.menuItemId, itemIds))
      : [];
    const variants = itemIds.length
      ? await this.db.select().from(menuItemVariants).where(inArray(menuItemVariants.menuItemId, itemIds))
      : [];
    return items.map((item) => ({
      ...item,
      commissionPct: item.commissionPct != null ? item.commissionPct : vendorCommissionPct,
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
        mealSlots: normalizeMealSlots(dto.mealSlots),
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
    const { addons, variants, mealSlots, ...fields } = dto;
    const updateData = {
      ...fields,
      ...(fields.imageUrl !== undefined ? { imageUrl: fields.imageUrl || null } : {}),
      ...(fields.description !== undefined ? { description: fields.description || null } : {}),
      ...(mealSlots !== undefined ? { mealSlots: normalizeMealSlots(mealSlots) } : {}),
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

  private async replaceVariants(menuItemId: string, variants?: MenuItemVariantInput[], basePrice?: number) {
    await this.db.delete(menuItemVariants).where(eq(menuItemVariants.menuItemId, menuItemId));
    if (!variants || variants.length === 0) return [];
    return this.db
      .insert(menuItemVariants)
      .values(
        variants.map((v) => ({
          menuItemId,
          name: v.name,
          priceDelta:
            v.priceDelta !== undefined
              ? v.priceDelta
              : typeof v.price === 'number'
              ? basePrice !== undefined
                ? v.price - basePrice
                : v.price
              : 0,
          isDefault: v.isDefault ?? false,
        })),
      )
      .returning();
  }

  // ---------- Vendor + Admin: product suggestions ----------

  // A product the vendor asks Laoji to add to its catalog, filed under one of
  // Laoji's categories (the store's copy of one counts as that one).
  async createProductSuggestion(vendor: VendorRef, dto: CreateProductSuggestionDto) {
    const { byId } = await this.categoryIndex();
    const category = byId.get(dto.categoryId);
    if (!category || (category.ownerVendorId !== null && category.ownerVendorId !== vendor.id)) {
      throw new NotFoundException('Category not found');
    }
    const categoryId = laojiCategoryId(category.id, byId);
    if (byId.get(categoryId)?.ownerVendorId !== null) {
      throw new BadRequestException(
        `"${category.name}" is your store's own category. Pick one of Laoji's categories, or suggest "${category.name}" as a new category first.`,
      );
    }
    const [row] = await this.db
      .insert(productSuggestions)
      .values({
        vendorId: vendor.id,
        name: dto.name.trim(),
        categoryId,
        unit: dto.unit.trim(),
        size: dto.size?.trim() || undefined,
        imageUrl: dto.imageUrl,
      })
      .returning();

    const [vendorRow] = await this.db.select().from(vendors).where(eq(vendors.id, vendor.id)).limit(1);
    this.notifications.notifyAllAdminsPush(
      'product_suggestion',
      productSuggestionCreatedAdminPush(dto.name.trim(), category.name, vendorRow?.businessName),
    );

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

  // ---------- Vendor + Admin: category suggestions ----------

  // A category the vendor asks Laoji to add to its list for the vendor's
  // business type. Meanwhile the vendor can make it a category of its own.
  async createCategorySuggestion(vendor: VendorRef, dto: CreateCategorySuggestionDto) {
    if (!BUSINESS_TYPE_ROOT_CATEGORY[vendor.businessType]) {
      throw new BadRequestException('Restaurants manage menu categories from the menu screen');
    }
    const name = dto.name.trim();
    if (name.length < 2) throw new BadRequestException('Category name is required');
    const scope = await this.vendorCategories(vendor);
    const parentIds = new Set(scope.all.map((c) => c.parentId));
    const offered = scope.all.find((c) => scope.isTemplateFor(c) && !parentIds.has(c.id) && sameName(c.name, name));
    if (offered) {
      throw new ConflictException(
        `Laoji already has a "${offered.name}" category. Add it to your store from Laoji's categories.`,
      );
    }
    const [pending] = await this.db
      .select({ id: categorySuggestions.id })
      .from(categorySuggestions)
      .where(
        and(
          eq(categorySuggestions.vendorId, vendor.id),
          eq(categorySuggestions.status, 'pending'),
          sql`lower(${categorySuggestions.name}) = lower(${name})`,
        ),
      )
      .limit(1);
    if (pending) throw new ConflictException(`You have already suggested "${name}". Laoji will review it soon.`);

    const [row] = await this.db
      .insert(categorySuggestions)
      .values({ vendorId: vendor.id, name, businessType: vendor.businessType, note: dto.note?.trim() || null })
      .returning();

    const [vendorRow] = await this.db.select().from(vendors).where(eq(vendors.id, vendor.id)).limit(1);
    this.notifications.notifyAllAdminsPush(
      'category_suggestion',
      categorySuggestionCreatedAdminPush(name, vendor.businessType, vendorRow?.businessName),
    );

    return row;
  }

  listMyCategorySuggestions(vendorId: string) {
    return this.db
      .select()
      .from(categorySuggestions)
      .where(eq(categorySuggestions.vendorId, vendorId))
      .orderBy(desc(categorySuggestions.createdAt));
  }

  async listCategorySuggestions(status?: 'pending' | 'approved' | 'rejected') {
    const rows = await this.db
      .select({ suggestion: categorySuggestions, vendor: vendors })
      .from(categorySuggestions)
      .innerJoin(vendors, eq(categorySuggestions.vendorId, vendors.id))
      .where(status ? eq(categorySuggestions.status, status) : undefined)
      .orderBy(desc(categorySuggestions.createdAt));
    return rows.map(({ suggestion, vendor }) => ({ ...suggestion, vendorName: vendor.businessName }));
  }

  private async requirePendingCategorySuggestion(id: string) {
    const [row] = await this.db.select().from(categorySuggestions).where(eq(categorySuggestions.id, id)).limit(1);
    if (!row) throw new NotFoundException('Suggestion not found');
    if (row.status !== 'pending') throw new ConflictException('Suggestion has already been reviewed');
    return row;
  }

  // Approving adds the category to Laoji's list: under the suggesting store
  // type's root unless admin picks another parent, or as the Laoji category
  // of that name if there already is one. The suggesting store's own
  // category of that name becomes its copy of it, so customers find the
  // store's products there.
  async approveCategorySuggestion(adminUserId: string, id: string, dto: ApproveCategorySuggestionDto) {
    const suggestion = await this.requirePendingCategorySuggestion(id);
    const name = dto.name?.trim() || suggestion.name;
    let parentId: string;
    if (dto.parentId) {
      const [parent] = await this.db.select().from(categories).where(eq(categories.id, dto.parentId)).limit(1);
      if (!parent || parent.ownerVendorId !== null) throw new NotFoundException('Parent category not found');
      parentId = parent.id;
    } else {
      parentId = (await this.businessTypeRoot(suggestion.businessType)).id;
    }
    const [existing] = await this.db
      .select()
      .from(categories)
      .where(
        and(
          isNull(categories.ownerVendorId),
          eq(categories.parentId, parentId),
          sql`lower(${categories.name}) = lower(${name})`,
        ),
      )
      .limit(1);
    const category = existing ?? (await this.createCategory({ name, parentId }));

    const [updated] = await this.db
      .update(categorySuggestions)
      .set({ status: 'approved', categoryId: category.id, reviewedBy: adminUserId, reviewedAt: new Date() })
      .where(eq(categorySuggestions.id, id))
      .returning();

    const copies = await this.ownCategoryCopies(suggestion.vendorId);
    if (!copies.has(category.id)) {
      const [own] = await this.db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.ownerVendorId, suggestion.vendorId),
            isNull(categories.templateCategoryId),
            sql`lower(${categories.name}) = lower(${suggestion.name})`,
          ),
        )
        .limit(1);
      if (own) {
        await this.db.update(categories).set({ templateCategoryId: category.id }).where(eq(categories.id, own.id));
        await this.moveOwnProducts(suggestion.vendorId, category.id, own.id);
      }
    }

    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, suggestion.vendorId)).limit(1);
    if (vendor) {
      this.notifications.notifyPush(
        vendor.userId,
        'category_suggestion_approved',
        categorySuggestionApprovedVendorPush(category.name),
      );
    }
    return { ...updated, category };
  }

  async rejectCategorySuggestion(adminUserId: string, id: string, reason: string) {
    const suggestion = await this.requirePendingCategorySuggestion(id);
    const [updated] = await this.db
      .update(categorySuggestions)
      .set({ status: 'rejected', rejectionReason: reason, reviewedBy: adminUserId, reviewedAt: new Date() })
      .where(eq(categorySuggestions.id, id))
      .returning();

    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, suggestion.vendorId)).limit(1);
    if (vendor) {
      this.notifications.notifyPush(
        vendor.userId,
        'category_suggestion_rejected',
        categorySuggestionRejectedVendorPush(suggestion.name),
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
        restaurantImageUrl: restaurants.imageUrl,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .leftJoin(restaurants, eq(restaurants.vendorId, vendors.id))
      .orderBy(asc(vendors.displayOrder), asc(vendors.createdAt));

    // Batch resolve revenue config rules in 1 DB query
    const now = new Date();
    let globalCommission = 10;
    const vendorCommissionMap = new Map<string, number>();

    try {
      const revRows = await this.db.select().from(revenueConfig).where(lte(revenueConfig.effectiveFrom, now));
      const latest = (candidates: typeof revRows) =>
        candidates.length ? candidates.reduce((a, b) => (a.effectiveFrom > b.effectiveFrom ? a : b)) : null;
      const globalRule = latest(revRows.filter((r) => r.scope === 'global'));
      if (globalRule) {
        globalCommission = Math.round(globalRule.commissionPct * 100 * 10) / 10;
      }
      for (const r of revRows) {
        if (r.scope === 'vendor' && r.scopeRefId) {
          const allForVendor = revRows.filter((row) => row.scope === 'vendor' && row.scopeRefId === r.scopeRefId);
          const latestVendorRule = latest(allForVendor);
          if (latestVendorRule) {
            vendorCommissionMap.set(r.scopeRefId, Math.round(latestVendorRule.commissionPct * 100 * 10) / 10);
          }
        }
      }
    } catch {
      // ignore
    }

    return rows.map(({ vendor, user, restaurantImageUrl }) => ({
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
      isOpenNow: isVendorOpenNow(vendor),
      businessHours: vendor.businessHours,
      showInApp: vendor.showInApp ?? true,
      displayOrder: vendor.displayOrder ?? 0,
      deliveryRadiusKm: vendor.radiusKm,
      pickupLat: vendor.pickupLat,
      pickupLng: vendor.pickupLng,
      locationIsDefault: isDefaultPickup(vendor.pickupLat, vendor.pickupLng),
      commissionPct: vendorCommissionMap.get(vendor.id) ?? globalCommission,
      cashbackPct: 5,
      discountPct: 0,
      imageUrl: vendor.imageUrl || restaurantImageUrl || null,
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
    let productCount = 0;
    try {
      const vendorProds = await this.db.select().from(vendorProducts).where(eq(vendorProducts.vendorId, id));
      productCount = vendorProds.length;
    } catch {
      // ignore
    }
    if (restaurant) {
      try {
        const [menuCountRes] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(menuItems)
          .innerJoin(menuCategories, eq(menuItems.menuCategoryId, menuCategories.id))
          .where(eq(menuCategories.restaurantId, restaurant.id));
        const restCount = Number(menuCountRes?.count ?? 0);
        productCount = Math.max(productCount, restCount);
      } catch {
        // ignore
      }
    }

    let kycDocs: any[] = [];
    try {
      kycDocs = await this.db
        .select({
          id: kycDocuments.id,
          userId: kycDocuments.userId,
          role: kycDocuments.role,
          docType: kycDocuments.docType,
          secureUrl: kycDocuments.secureUrl,
          publicId: kycDocuments.publicId,
          status: kycDocuments.status,
          rejectionReason: kycDocuments.rejectionReason,
          reviewedBy: kycDocuments.reviewedBy,
          reviewedAt: kycDocuments.reviewedAt,
          uploadedAt: kycDocuments.uploadedAt,
        })
        .from(kycDocuments)
        .where(eq(kycDocuments.userId, vendor.userId))
        .orderBy(desc(kycDocuments.uploadedAt));
    } catch {
      // ignore
    }

    const commissionPct = await this.resolveVendorCommissionPct(vendor.id);

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
      kycDocuments: kycDocs,
      activity: vendor.isOpen ? 'active' : 'inactive',
      isOpen: vendor.isOpen,
      isOpenNow: isVendorOpenNow(vendor),
      businessHours: vendor.businessHours,
      showInApp: vendor.showInApp ?? true,
      displayOrder: vendor.displayOrder ?? 0,
      deliveryRadiusKm: vendor.radiusKm,
      pickupLat: vendor.pickupLat,
      pickupLng: vendor.pickupLng,
      locationIsDefault: isDefaultPickup(vendor.pickupLat, vendor.pickupLng),
      commissionPct,
      cashbackPct: 5,
      discountPct: 0,
      imageUrl: vendor.imageUrl || restaurant?.imageUrl || null,
      rating: restaurant?.ratingAvg ?? 4.8,
      ratingCount: 12,
      productCount,
      createdAt: vendor.createdAt,
    };
  }

  async getAdminVendorListings(vendorId: string) {
    let resolvedVendorId = vendorId;
    let [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) {
      const [rest] = await this.db.select().from(restaurants).where(eq(restaurants.id, vendorId)).limit(1);
      if (rest) {
        resolvedVendorId = rest.vendorId;
        const [v] = await this.db.select().from(vendors).where(eq(vendors.id, resolvedVendorId)).limit(1);
        vendor = v;
      }
    }
    if (!vendor) throw new NotFoundException('Vendor not found');

    const [discounts, vendorCommissionPct] = await Promise.all([
      this.vendorDiscounts.getActiveDiscountsForVendor(resolvedVendorId),
      this.resolveVendorCommissionPct(resolvedVendorId),
    ]);

    const results: {
      id: string;
      itemType: 'grocery' | 'menu_item';
      productId?: string;
      name: string;
      description: string | null;
      category: string;
      categoryId?: string | null;
      price: number;
      originalPrice?: number;
      discountedPrice?: number;
      discountLabel?: string | null;
      unit: string;
      available: boolean;
      imageUrl: string | null;
      isVeg?: boolean;
      stockQty?: number;
      isCustomisable?: boolean;
      variants?: any[];
      addons?: any[];
      commissionPct?: number;
      customCommissionPct?: number | null;
      wholesalePrice?: number | null;
    }[] = [];

    // 1. Fetch grocery products
    try {
      const vProds = await this.db
        .select({
          id: vendorProducts.id,
          price: vendorProducts.price,
          wholesalePrice: vendorProducts.wholesalePrice,
          stockQty: vendorProducts.stockQty,
          isAvailable: vendorProducts.isAvailable,
          customCommissionPct: vendorProducts.commissionPct,
          productId: products.id,
          name: products.name,
          description: products.description,
          unit: products.unit,
          imageUrl: products.imageUrl,
          categoryId: categories.id,
          categoryName: categories.name,
        })
        .from(vendorProducts)
        .innerJoin(products, eq(vendorProducts.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(eq(vendorProducts.vendorId, resolvedVendorId));

      for (const vp of vProds) {
        const disc = this.vendorDiscounts.calculateItemDiscount(vp.price, discounts, { productId: vp.productId });
        results.push({
          id: vp.id,
          itemType: 'grocery',
          productId: vp.productId,
          name: vp.name,
          description: vp.description ?? null,
          category: vp.categoryName ?? 'General',
          categoryId: vp.categoryId,
          price: disc.price,
          wholesalePrice: vp.wholesalePrice ?? null,
          originalPrice: vp.price,
          discountedPrice: disc.discountApplied ? disc.price : undefined,
          discountLabel: disc.discountLabel ?? null,
          unit: vp.unit,
          available: vp.isAvailable,
          imageUrl: vp.imageUrl ?? null,
          stockQty: vp.stockQty,
          commissionPct: vp.customCommissionPct != null ? vp.customCommissionPct : vendorCommissionPct,
          customCommissionPct: vp.customCommissionPct ?? null,
        });
      }
    } catch (err) {
      console.warn('[getAdminVendorListings] grocery listings query failed:', err);
    }

    // 2. Fetch restaurant menu items
    try {
      const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, resolvedVendorId)).limit(1);
      if (restaurant) {
        const mItems = await this.db
          .select({
            id: menuItems.id,
            name: menuItems.name,
            description: menuItems.description,
            price: menuItems.price,
            isAvailable: menuItems.isAvailable,
            imageUrl: menuItems.imageUrl,
            isVeg: menuItems.isVeg,
            customCommissionPct: menuItems.commissionPct,
            categoryId: menuCategories.id,
            categoryName: menuCategories.name,
          })
          .from(menuItems)
          .innerJoin(menuCategories, eq(menuItems.menuCategoryId, menuCategories.id))
          .where(eq(menuCategories.restaurantId, restaurant.id));

        const mItemIds = mItems.map((i) => i.id);
        const allVariants = mItemIds.length
          ? await this.db.select().from(menuItemVariants).where(inArray(menuItemVariants.menuItemId, mItemIds))
          : [];
        const allAddons = mItemIds.length
          ? await this.db.select().from(menuItemAddons).where(inArray(menuItemAddons.menuItemId, mItemIds))
          : [];

        for (const mi of mItems) {
          const itemVariants = allVariants.filter((v) => v.menuItemId === mi.id);
          const itemAddons = allAddons.filter((a) => a.menuItemId === mi.id);
          const disc = this.vendorDiscounts.calculateItemDiscount(mi.price, discounts, { menuItemId: mi.id });
          results.push({
            id: mi.id,
            itemType: 'menu_item',
            name: mi.name,
            description: mi.description,
            category: mi.categoryName,
            categoryId: mi.categoryId,
            price: disc.price,
            originalPrice: mi.price,
            discountedPrice: disc.discountApplied ? disc.price : undefined,
            discountLabel: disc.discountLabel ?? null,
            unit: 'piece',
            available: mi.isAvailable,
            imageUrl: mi.imageUrl,
            isVeg: mi.isVeg,
            isCustomisable: itemVariants.length > 0 || itemAddons.length > 0,
            variants: itemVariants,
            addons: itemAddons,
            commissionPct: mi.customCommissionPct != null ? mi.customCommissionPct : vendorCommissionPct,
            customCommissionPct: mi.customCommissionPct ?? null,
          });
        }
      }
    } catch (err) {
      console.warn('[getAdminVendorListings] restaurant items query failed:', err);
    }

    return results;
  }

  async addAdminVendorItem(vendorId: string, dto: CreateAdminVendorItemDto) {
    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) throw new NotFoundException('Vendor not found');
    const vendorCommissionPct = await this.resolveVendorCommissionPct(vendorId);

    const isRestaurantItem =
      dto.itemType === 'menu_item' || (vendor.businessType === 'restaurant' && dto.itemType !== 'grocery');

    if (isRestaurantItem) {
      const restaurant = await this.getOrCreateRestaurant(vendorId);

      let targetCatId = dto.categoryId;
      if (targetCatId) {
        const [cat] = await this.db
          .select()
          .from(menuCategories)
          .where(and(eq(menuCategories.id, targetCatId), eq(menuCategories.restaurantId, restaurant.id)))
          .limit(1);
        if (!cat) targetCatId = undefined;
      }

      if (!targetCatId) {
        const [existingCat] = await this.db
          .select()
          .from(menuCategories)
          .where(eq(menuCategories.restaurantId, restaurant.id))
          .limit(1);
        if (existingCat) {
          targetCatId = existingCat.id;
        } else {
          const [newCat] = await this.db
            .insert(menuCategories)
            .values({
              restaurantId: restaurant.id,
              name: 'Main Menu',
              sortOrder: 0,
            })
            .returning();
          targetCatId = newCat.id;
        }
      }

      const [item] = await this.db
        .insert(menuItems)
        .values({
          menuCategoryId: targetCatId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          price: dto.price,
          imageUrl: dto.imageUrl?.trim() || null,
          isVeg: dto.isVeg ?? true,
          isAvailable: dto.isAvailable ?? true,
          commissionPct: dto.commissionPct !== undefined ? dto.commissionPct : null,
        })
        .returning();

      if (dto.variants && dto.variants.length > 0) {
        await this.replaceVariants(item.id, dto.variants, dto.price);
      }
      if (dto.addons && dto.addons.length > 0) {
        await this.replaceAddons(item.id, dto.addons);
      }

      return {
        id: item.id,
        itemType: 'menu_item' as const,
        name: item.name,
        description: item.description,
        price: item.price,
        unit: 'portion',
        available: item.isAvailable,
        imageUrl: item.imageUrl,
        isVeg: item.isVeg,
        categoryId: targetCatId,
        isCustomisable: Boolean((dto.variants && dto.variants.length > 0) || (dto.addons && dto.addons.length > 0)),
        commissionPct: item.commissionPct != null ? item.commissionPct : vendorCommissionPct,
        customCommissionPct: item.commissionPct ?? null,
      };
    } else {
      // Grocery item
      let productId = dto.productId;

      if (productId) {
        const [existingProd] = await this.db.select().from(products).where(eq(products.id, productId)).limit(1);
        if (!existingProd) throw new NotFoundException('Specified product not found');
      } else {
        let categoryId = dto.categoryId;
        if (categoryId) {
          const [cat] = await this.db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
          if (!cat) categoryId = undefined;
        }
        if (!categoryId) {
          const [firstCat] = await this.db.select().from(categories).limit(1);
          if (!firstCat) throw new BadRequestException('No categories exist in database');
          categoryId = firstCat.id;
        }

        const [createdProd] = await this.db
          .insert(products)
          .values({
            categoryId,
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            unit: dto.unit?.trim() || '1 pc',
            imageUrl: dto.imageUrl?.trim() || null,
            status: 'active',
            ownerVendorId: vendor.id,
          })
          .returning();
        productId = createdProd.id;
      }

      // Check if vendor already has a listing for this product
      const [existingListing] = await this.db
        .select()
        .from(vendorProducts)
        .where(and(eq(vendorProducts.vendorId, vendor.id), eq(vendorProducts.productId, productId)))
        .limit(1);

      if (existingListing) {
        const [updated] = await this.db
          .update(vendorProducts)
          .set({
            price: dto.price,
            stockQty: dto.stockQty ?? existingListing.stockQty,
            isAvailable: dto.isAvailable ?? true,
            commissionPct: dto.commissionPct !== undefined ? dto.commissionPct : existingListing.commissionPct,
            lastRestockedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(vendorProducts.id, existingListing.id))
          .returning();
        const [prod] = await this.db.select().from(products).where(eq(products.id, productId)).limit(1);
        return {
          id: updated.id,
          itemType: 'grocery' as const,
          productId: prod.id,
          name: prod.name,
          description: prod.description,
          price: updated.price,
          unit: prod.unit,
          available: updated.isAvailable,
          imageUrl: prod.imageUrl,
          categoryId: prod.categoryId,
          stockQty: updated.stockQty,
          commissionPct: updated.commissionPct != null ? updated.commissionPct : vendorCommissionPct,
          customCommissionPct: updated.commissionPct ?? null,
        };
      }

      const [createdListing] = await this.db
        .insert(vendorProducts)
        .values({
          vendorId: vendor.id,
          productId,
          price: dto.price,
          stockQty: dto.stockQty ?? 100,
          isAvailable: dto.isAvailable ?? true,
          commissionPct: dto.commissionPct !== undefined ? dto.commissionPct : null,
          lastRestockedAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const [prod] = await this.db.select().from(products).where(eq(products.id, productId)).limit(1);
      return {
        id: createdListing.id,
        itemType: 'grocery' as const,
        productId: prod.id,
        name: prod.name,
        description: prod.description,
        price: createdListing.price,
        unit: prod.unit,
        available: createdListing.isAvailable,
        imageUrl: prod.imageUrl,
        categoryId: prod.categoryId,
        stockQty: createdListing.stockQty,
        commissionPct: createdListing.commissionPct != null ? createdListing.commissionPct : vendorCommissionPct,
        customCommissionPct: createdListing.commissionPct ?? null,
      };
    }
  }

  async updateAdminVendorItem(vendorId: string, itemId: string, dto: UpdateAdminVendorItemDto) {
    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) throw new NotFoundException('Vendor not found');

    // 1. Try finding in vendorProducts (grocery)
    const [vp] = await this.db
      .select()
      .from(vendorProducts)
      .where(and(eq(vendorProducts.id, itemId), eq(vendorProducts.vendorId, vendorId)))
      .limit(1);

    if (vp) {
      const vpUpdates: any = { updatedAt: new Date() };
      if (dto.price !== undefined) vpUpdates.price = dto.price;
      if (dto.wholesalePrice !== undefined) vpUpdates.wholesalePrice = dto.wholesalePrice;
      if (dto.isAvailable !== undefined) vpUpdates.isAvailable = dto.isAvailable;
      if (dto.stockQty !== undefined) vpUpdates.stockQty = dto.stockQty;
      if (dto.commissionPct !== undefined) vpUpdates.commissionPct = dto.commissionPct;

      await this.db.update(vendorProducts).set(vpUpdates).where(eq(vendorProducts.id, vp.id));

      const [prod] = await this.db.select().from(products).where(eq(products.id, vp.productId)).limit(1);
      if (prod) {
        if (prod.ownerVendorId === vendorId) {
          const prodUpdates: any = {};
          if (dto.name !== undefined) prodUpdates.name = dto.name.trim();
          if (dto.description !== undefined) prodUpdates.description = dto.description?.trim() || null;
          if (dto.unit !== undefined) prodUpdates.unit = dto.unit.trim();
          if (dto.imageUrl !== undefined) prodUpdates.imageUrl = dto.imageUrl?.trim() || null;
          if (dto.categoryId !== undefined) prodUpdates.categoryId = dto.categoryId;

          if (Object.keys(prodUpdates).length > 0) {
            await this.db.update(products).set(prodUpdates).where(eq(products.id, prod.id));
          }
        } else {
          const hasDetailChanges =
            (dto.name !== undefined && dto.name.trim() !== prod.name) ||
            (dto.imageUrl !== undefined && dto.imageUrl?.trim() !== (prod.imageUrl ?? '')) ||
            (dto.unit !== undefined && dto.unit.trim() !== prod.unit) ||
            (dto.description !== undefined && dto.description?.trim() !== (prod.description ?? '')) ||
            (dto.categoryId !== undefined && dto.categoryId !== prod.categoryId);

          if (hasDetailChanges) {
            const [copy] = await this.db
              .insert(products)
              .values({
                categoryId: dto.categoryId ?? prod.categoryId,
                brand: prod.brand,
                name: dto.name?.trim() ?? prod.name,
                description: dto.description !== undefined ? dto.description?.trim() || null : prod.description,
                unit: dto.unit?.trim() ?? prod.unit,
                size: prod.size,
                mrp: prod.mrp,
                wholesalePrice: prod.wholesalePrice,
                sellingPrice: prod.sellingPrice,
                imageUrl: dto.imageUrl !== undefined ? dto.imageUrl?.trim() || null : prod.imageUrl,
                attributes: prod.attributes,
                status: 'active',
                ownerVendorId: vendorId,
                templateProductId: prod.id,
              })
              .returning();
            await this.db.update(vendorProducts).set({ productId: copy.id }).where(eq(vendorProducts.id, vp.id));
          }
        }
      }

      return { success: true };
    }

    // 2. Try finding in menuItems (restaurant)
    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, vendorId)).limit(1);
    if (restaurant) {
      const [mi] = await this.db
        .select({ id: menuItems.id, price: menuItems.price })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuItems.menuCategoryId, menuCategories.id))
        .where(and(eq(menuItems.id, itemId), eq(menuCategories.restaurantId, restaurant.id)))
        .limit(1);

      if (mi) {
        const miUpdates: any = {};
        if (dto.name !== undefined) miUpdates.name = dto.name.trim();
        if (dto.description !== undefined) miUpdates.description = dto.description?.trim() || null;
        if (dto.price !== undefined) miUpdates.price = dto.price;
        if (dto.imageUrl !== undefined) miUpdates.imageUrl = dto.imageUrl?.trim() || null;
        if (dto.isVeg !== undefined) miUpdates.isVeg = dto.isVeg;
        if (dto.isAvailable !== undefined) miUpdates.isAvailable = dto.isAvailable;
        if (dto.commissionPct !== undefined) miUpdates.commissionPct = dto.commissionPct;

        if (dto.categoryId !== undefined) {
          const [validCat] = await this.db
            .select()
            .from(menuCategories)
            .where(and(eq(menuCategories.id, dto.categoryId), eq(menuCategories.restaurantId, restaurant.id)))
            .limit(1);
          if (validCat) miUpdates.menuCategoryId = validCat.id;
        }

        if (Object.keys(miUpdates).length > 0) {
          await this.db.update(menuItems).set(miUpdates).where(eq(menuItems.id, itemId));
        }

        if (dto.variants !== undefined) {
          await this.replaceVariants(itemId, dto.variants, dto.price ?? mi.price);
        }
        if (dto.addons !== undefined) {
          await this.replaceAddons(itemId, dto.addons);
        }

        return { success: true };
      }
    }

    throw new NotFoundException('Item not found in this vendor catalog');
  }

  async deleteAdminVendorItem(vendorId: string, itemId: string) {
    // 1. Grocery listing
    const [vp] = await this.db
      .select()
      .from(vendorProducts)
      .where(and(eq(vendorProducts.id, itemId), eq(vendorProducts.vendorId, vendorId)))
      .limit(1);

    if (vp) {
      await this.db.delete(vendorProducts).where(eq(vendorProducts.id, vp.id));
      const [prod] = await this.db.select().from(products).where(eq(products.id, vp.productId)).limit(1);
      if (prod && prod.ownerVendorId === vendorId) {
        const [ordered] = await this.db
          .select({ id: groceryOrderItems.id })
          .from(groceryOrderItems)
          .where(eq(groceryOrderItems.productId, prod.id))
          .limit(1);
        if (!ordered) {
          await this.db.delete(products).where(eq(products.id, prod.id));
        }
      }
      return { success: true };
    }

    // 2. Restaurant menu item
    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, vendorId)).limit(1);
    if (restaurant) {
      const [mi] = await this.db
        .select({ id: menuItems.id })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuItems.menuCategoryId, menuCategories.id))
        .where(and(eq(menuItems.id, itemId), eq(menuCategories.restaurantId, restaurant.id)))
        .limit(1);

      if (mi) {
        await this.db.delete(menuItems).where(eq(menuItems.id, mi.id));
        return { success: true };
      }
    }

    throw new NotFoundException('Item not found');
  }

  async bulkDeleteAdminVendorItems(vendorId: string, itemIds: string[]) {
    if (!itemIds || itemIds.length === 0) {
      return { success: true, count: 0 };
    }

    let deletedCount = 0;
    for (const itemId of itemIds) {
      try {
        await this.deleteAdminVendorItem(vendorId, itemId);
        deletedCount++;
      } catch (e) {
        // Continue with remaining items
      }
    }

    return { success: true, count: deletedCount };
  }


  async createAdminVendor(dto: CreateAdminVendorDto, adminUserId?: string) {
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
          eq(users.status, 'active'),
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
        pickupLat: dto.pickupLat ?? DEFAULT_PICKUP.lat,
        pickupLng: dto.pickupLng ?? DEFAULT_PICKUP.lng,
        radiusKm: dto.deliveryRadiusKm ?? 5,
        kycStatus: kycStat,
        isOpen: true,
        showInApp: dto.showInApp ?? true,
        displayOrder: dto.displayOrder ?? 0,
        imageUrl: dto.imageUrl ? dto.imageUrl.trim() : null,
      })
      .returning();

    // Always ensure a restaurant/store record exists for every vendor
    const [existingRest] = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, vendor.id)).limit(1);
    if (!existingRest) {
      await this.db.insert(restaurants).values({
        vendorId: vendor.id,
        name: dto.businessName.trim(),
        imageUrl: dto.imageUrl ? dto.imageUrl.trim() : null,
      });
    }

    // If commissionPct is provided, create a vendor-scoped revenue config rule
    if (dto.commissionPct !== undefined && !isNaN(dto.commissionPct) && dto.commissionPct >= 0) {
      try {
        const commissionFraction = dto.commissionPct > 1 ? dto.commissionPct / 100 : dto.commissionPct;
        if (this.revenueConfig) {
          const currentResolved = await this.revenueConfig.resolve(vendor.id, null);
          await this.revenueConfig.create(adminUserId || vendor.userId, {
            scope: 'vendor',
            scopeRefId: vendor.id,
            commissionPct: commissionFraction,
            deliveryFeeFlat: currentResolved.deliveryFeeFlat ?? 15,
            freeDeliveryThreshold: currentResolved.freeDeliveryThreshold ?? 99,
            deliveryFeeTier1: currentResolved.deliveryFeeTier1 ?? 10,
            deliveryFeeTier2: currentResolved.deliveryFeeTier2 ?? 15,
            deliveryFeeTier3: currentResolved.deliveryFeeTier3 ?? 20,
            minOrderValue: currentResolved.minOrderValue ?? 50,
            codThreshold: currentResolved.codThreshold ?? undefined,
            notes: 'Initial commission set during vendor creation',
            effectiveFrom: new Date().toISOString(),
          });
        } else {
          await this.db.insert(revenueConfig).values({
            scope: 'vendor',
            scopeRefId: vendor.id,
            commissionPct: commissionFraction,
            deliveryFeeFlat: 15,
            freeDeliveryThreshold: 99,
            deliveryFeeTier1: 10,
            deliveryFeeTier2: 15,
            deliveryFeeTier3: 20,
            minOrderValue: 50,
            codThreshold: null,
            notes: 'Initial commission set during vendor creation',
            effectiveFrom: new Date(),
            createdBy: adminUserId || vendor.userId,
          });
        }
      } catch (err) {
        console.error('[CatalogService] Failed to create vendor revenue config:', err);
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

    const commissionPct = await this.resolveVendorCommissionPct(vendor.id);

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
      pickupLat: vendor.pickupLat,
      pickupLng: vendor.pickupLng,
      locationIsDefault: isDefaultPickup(vendor.pickupLat, vendor.pickupLng),
      commissionPct,
      cashbackPct: 5,
      discountPct: 0,
      imageUrl: vendor.imageUrl || null,
      tempPassword,
      createdAt: vendor.createdAt,
    };
  }

  // Admin sets a new password for a vendor. The vendor must choose their own on
  // next login, and existing sessions are revoked.
  async resetAdminVendorPassword(vendorId: string, newPassword: string) {
    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) throw new NotFoundException('Vendor not found');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db
      .update(users)
      .set({ passwordHash, mustChangePassword: true })
      .where(eq(users.id, vendor.userId));
    await this.db.update(authTokens).set({ revokedAt: new Date() }).where(eq(authTokens.userId, vendor.userId));

    return { success: true, message: 'Vendor password updated.' };
  }

  async reorderVendors(dto: ReorderVendorsDto) {
    if (dto.orders && Array.isArray(dto.orders)) {
      for (const item of dto.orders) {
        await this.db
          .update(vendors)
          .set({ displayOrder: item.displayOrder })
          .where(eq(vendors.id, item.id));
      }
    } else if (dto.vendorIds && Array.isArray(dto.vendorIds)) {
      for (let i = 0; i < dto.vendorIds.length; i++) {
        await this.db
          .update(vendors)
          .set({ displayOrder: i + 1 })
          .where(eq(vendors.id, dto.vendorIds[i]));
      }
    }
    return this.listVendorsAdmin();
  }

  async updateAdminVendor(id: string, dto: UpdateAdminVendorDto, adminUserId?: string) {
    const [v] = await this.db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!v) throw new NotFoundException('Vendor not found');

    const updateFields: any = {};
    if (dto.businessName !== undefined) updateFields.businessName = dto.businessName;
    if (dto.ownerName !== undefined) updateFields.ownerName = dto.ownerName;
    if (dto.type !== undefined) updateFields.type = dto.type;
    if (dto.shopAddress !== undefined) updateFields.shopAddress = dto.shopAddress;
    if (dto.deliveryRadiusKm !== undefined) updateFields.radiusKm = dto.deliveryRadiusKm;
    if (dto.pickupLat !== undefined && dto.pickupLng !== undefined) {
      updateFields.pickupLat = dto.pickupLat;
      updateFields.pickupLng = dto.pickupLng;
    }
    if (dto.kycStatus !== undefined && dto.kycStatus !== 'unverified') updateFields.kycStatus = dto.kycStatus;
    if (dto.activity !== undefined) {
      const active = dto.activity === 'active';
      updateFields.isOpen = active;
    }
    if (dto.showInApp !== undefined) {
      updateFields.showInApp = dto.showInApp;
    }
    if (dto.isOpen !== undefined) {
      updateFields.isOpen = dto.isOpen;
    }
    if (dto.displayOrder !== undefined) updateFields.displayOrder = dto.displayOrder;
    if (dto.gstNumber !== undefined) updateFields.gstNumber = dto.gstNumber ? dto.gstNumber.trim() : null;
    if (dto.aadhaarNumber !== undefined) updateFields.aadhaarNumber = dto.aadhaarNumber ? dto.aadhaarNumber.trim() : null;
    if (dto.bankAccount !== undefined) updateFields.bankAccount = dto.bankAccount ? dto.bankAccount.trim() : null;
    if (dto.bankIfsc !== undefined) updateFields.bankIfsc = dto.bankIfsc ? dto.bankIfsc.trim().toUpperCase() : null;
    if (dto.upiId !== undefined) updateFields.upiId = dto.upiId ? dto.upiId.trim() : null;
    if (dto.imageUrl !== undefined) {
      updateFields.imageUrl = dto.imageUrl ? dto.imageUrl.trim() : null;
      await this.db.update(restaurants).set({ imageUrl: updateFields.imageUrl }).where(eq(restaurants.vendorId, id));
    }

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

    if (dto.commissionPct !== undefined && !isNaN(dto.commissionPct) && dto.commissionPct >= 0) {
      try {
        const commissionFraction = dto.commissionPct > 1 ? dto.commissionPct / 100 : dto.commissionPct;
        if (this.revenueConfig) {
          const currentResolved = await this.revenueConfig.resolve(id, null);
          if (Math.abs(currentResolved.commissionPct - commissionFraction) > 0.0001) {
            await this.revenueConfig.create(adminUserId || v.userId, {
              scope: 'vendor',
              scopeRefId: id,
              commissionPct: commissionFraction,
              deliveryFeeFlat: currentResolved.deliveryFeeFlat ?? 15,
              freeDeliveryThreshold: currentResolved.freeDeliveryThreshold ?? 99,
              deliveryFeeTier1: currentResolved.deliveryFeeTier1 ?? 10,
              deliveryFeeTier2: currentResolved.deliveryFeeTier2 ?? 15,
              deliveryFeeTier3: currentResolved.deliveryFeeTier3 ?? 20,
              minOrderValue: currentResolved.minOrderValue ?? 50,
              codThreshold: currentResolved.codThreshold ?? undefined,
              notes: 'Updated commission from vendor profile edit',
              effectiveFrom: new Date().toISOString(),
            });
          }
        } else {
          await this.db.insert(revenueConfig).values({
            scope: 'vendor',
            scopeRefId: id,
            commissionPct: commissionFraction,
            deliveryFeeFlat: 15,
            freeDeliveryThreshold: 99,
            deliveryFeeTier1: 10,
            deliveryFeeTier2: 15,
            deliveryFeeTier3: 20,
            minOrderValue: 50,
            codThreshold: null,
            notes: 'Updated commission from vendor profile edit',
            effectiveFrom: new Date(),
            createdBy: adminUserId || v.userId,
          });
        }
      } catch (err) {
        console.error('[CatalogService] Failed to update vendor revenue config:', err);
      }
    }

    return this.getAdminVendor(id);
  }

  async deleteAdminVendor(id: string) {
    const [v] = await this.db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!v) throw new NotFoundException('Vendor not found');

    // 1. Verify no active orders in progress
    const activeGrocery = await this.db
      .select({ id: groceryOrders.id })
      .from(groceryOrders)
      .where(
        and(
          eq(groceryOrders.vendorId, v.id),
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
      .where(eq(restaurants.vendorId, v.id))
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
        'Cannot delete vendor while active orders are in progress. Please complete or cancel remaining orders first.',
      );
    }

    // 2. Delete KYC documents belonging to this vendor user
    await this.db.delete(kycDocuments).where(eq(kycDocuments.userId, v.userId));

    // 3. Revoke auth tokens
    await this.db
      .update(authTokens)
      .set({ revokedAt: new Date() })
      .where(eq(authTokens.userId, v.userId));

    // 4. Try hard deleting the user (cascades to vendors, restaurants, products, etc.) or scrub if FK constraint from completed orders prevents
    try {
      await this.db.delete(users).where(eq(users.id, v.userId));
    } catch {
      await this.db.update(vendors).set({ isOpen: false }).where(eq(vendors.id, id));
      if (restaurant) {
        await this.db.update(restaurants).set({ isOpen: false }).where(eq(restaurants.id, restaurant.id));
      }
      await this.db
        .update(users)
        .set({ status: 'suspended', phone: null, email: null, name: null })
        .where(eq(users.id, v.userId));
    }

    return { success: true, message: `Vendor ${id} deleted successfully.` };
  }
}
