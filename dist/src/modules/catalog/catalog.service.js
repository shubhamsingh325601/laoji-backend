"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const catalog_types_1 = require("./catalog.types");
const product_forms_1 = require("./product-forms");
const catalog_ownership_1 = require("./catalog-ownership");
const meal_slots_1 = require("./meal-slots");
const notification_service_1 = require("../notification/notification.service");
const product_suggestion_1 = require("../notification/templates/push/product-suggestion");
const category_suggestion_1 = require("../notification/templates/push/category-suggestion");
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
let CatalogService = class CatalogService {
    db;
    notifications;
    constructor(db, notifications) {
        this.db = db;
        this.notifications = notifications;
    }
    async getVendorByUserId(userId) {
        const [row] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, userId)).limit(1);
        if (!row)
            return null;
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        const [rest] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, row.id)).limit(1);
        let ratingAvg = 4.8;
        let ratingCount = 0;
        if (rest) {
            const [agg] = await this.db
                .select({
                count: (0, drizzle_orm_1.sql) `count(*)::int`,
                avg: (0, drizzle_orm_1.sql) `coalesce(avg(${schema_1.foodOrderRatings.rating}), 0)::float`,
            })
                .from(schema_1.foodOrderRatings)
                .where((0, drizzle_orm_1.eq)(schema_1.foodOrderRatings.restaurantId, rest.id));
            if (agg && Number(agg.count) > 0) {
                ratingAvg = Math.round(Number(agg.avg) * 10) / 10;
                ratingCount = Number(agg.count);
            }
            else if (rest.ratingAvg && Number(rest.ratingAvg) > 0) {
                ratingAvg = Math.round(Number(rest.ratingAvg) * 10) / 10;
                ratingCount = 0;
            }
        }
        const isOpenNow = (0, catalog_types_1.isVendorOpenNow)(row);
        return {
            ...row,
            isOpenNow,
            locationIsDefault: (0, catalog_types_1.isDefaultPickup)(row.pickupLat, row.pickupLng),
            email: user?.email ?? null,
            phone: user?.phone ?? null,
            mustChangePassword: user?.mustChangePassword ?? false,
            ratingAvg,
            ratingCount,
        };
    }
    async requireVendor(userId) {
        const vendor = await this.getVendorByUserId(userId);
        if (!vendor)
            throw new common_1.NotFoundException('Vendor profile not set up yet');
        return vendor;
    }
    async upsertVendorProfile(userId, dto) {
        const existing = await this.getVendorByUserId(userId);
        const { pickupLat, pickupLng } = dto;
        if (existing) {
            const movePickup = pickupLat !== undefined && pickupLng !== undefined && !(0, catalog_types_1.isDefaultPickup)(pickupLat, pickupLng);
            const [updated] = await this.db
                .update(schema_1.vendors)
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
                .where((0, drizzle_orm_1.eq)(schema_1.vendors.id, existing.id))
                .returning();
            if (dto.imageUrl) {
                await this.db.update(schema_1.restaurants).set({ imageUrl: dto.imageUrl }).where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, existing.id));
            }
            return updated;
        }
        if (pickupLat === undefined || pickupLng === undefined) {
            throw new common_1.BadRequestException('Store location (pickupLat and pickupLng) is required');
        }
        const [created] = await this.db
            .insert(schema_1.vendors)
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
            await this.db.update(schema_1.restaurants).set({ imageUrl: dto.imageUrl }).where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, created.id));
        }
        return created;
    }
    async updateBusinessHours(userId, dto) {
        const vendor = await this.requireVendor(userId);
        const updateData = { isOpen: dto.isOpen };
        if (dto.schedule !== undefined) {
            updateData.businessHours = dto.schedule;
        }
        const [updated] = await this.db
            .update(schema_1.vendors)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendor.id))
            .returning();
        await this.db
            .update(schema_1.restaurants)
            .set({ isOpen: dto.isOpen })
            .where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, vendor.id));
        return {
            ...updated,
            isOpenNow: (0, catalog_types_1.isVendorOpenNow)(updated),
        };
    }
    async updateVendorLocation(userId, dto) {
        const vendor = await this.requireVendor(userId);
        if (dto.pickupLat === 0 && dto.pickupLng === 0) {
            throw new common_1.BadRequestException('Could not read a valid location. Please try again.');
        }
        const [updated] = await this.db
            .update(schema_1.vendors)
            .set({ pickupLat: dto.pickupLat, pickupLng: dto.pickupLng })
            .where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendor.id))
            .returning();
        return { ...updated, isOpenNow: (0, catalog_types_1.isVendorOpenNow)(updated) };
    }
    async deleteVendorAccount(userId) {
        const vendor = await this.requireVendor(userId);
        const activeGrocery = await this.db
            .select({ id: schema_1.groceryOrders.id })
            .from(schema_1.groceryOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.vendorId, vendor.id), (0, drizzle_orm_1.inArray)(schema_1.groceryOrders.status, [
            'placed',
            'vendor_accepted',
            'preparing',
            'ready',
            'handed_over',
            'delivery_assigned',
            'picked_up',
            'out_for_delivery',
        ])))
            .limit(1);
        const [restaurant] = await this.db
            .select()
            .from(schema_1.restaurants)
            .where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, vendor.id))
            .limit(1);
        let activeFood = [];
        if (restaurant) {
            activeFood = await this.db
                .select({ id: schema_1.foodOrders.id })
                .from(schema_1.foodOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, restaurant.id), (0, drizzle_orm_1.inArray)(schema_1.foodOrders.status, [
                'placed',
                'vendor_accepted',
                'preparing',
                'ready',
                'handed_over',
                'delivery_assigned',
                'picked_up',
                'out_for_delivery',
            ])))
                .limit(1);
        }
        if (activeGrocery.length > 0 || activeFood.length > 0) {
            throw new common_1.BadRequestException('Cannot delete account while you have active orders in progress. Please complete or cancel remaining orders first.');
        }
        await this.db.update(schema_1.vendors).set({ isOpen: false }).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendor.id));
        if (restaurant) {
            await this.db.update(schema_1.restaurants).set({ isOpen: false }).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, restaurant.id));
        }
        await this.db
            .update(schema_1.users)
            .set({ status: 'suspended', phone: null, email: null })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        await this.db
            .update(schema_1.authTokens)
            .set({ revokedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.authTokens.userId, userId));
        return { success: true, message: 'Vendor account deleted successfully.' };
    }
    async listVendorsBasic() {
        const rows = await this.db.select().from(schema_1.vendors);
        return rows.map((v) => ({ id: v.id, businessName: v.businessName, type: v.type }));
    }
    async listRestaurantsBasic() {
        const rows = await this.db.select().from(schema_1.restaurants);
        return rows.map((r) => ({ id: r.id, name: r.name, vendorId: r.vendorId }));
    }
    async listMenuItemsBasic() {
        const rows = await this.db.select().from(schema_1.menuItems);
        return rows.map((i) => ({ id: i.id, name: i.name }));
    }
    listCategoriesFlat() {
        return this.db.select().from(schema_1.categories);
    }
    async listCustomerCategories() {
        const all = await this.listCategoriesFlat();
        return all.filter((c) => c.ownerVendorId === null || c.templateCategoryId === null);
    }
    async listCategoriesTree() {
        const all = (await this.listCategoriesFlat()).filter((c) => c.ownerVendorId === null);
        const laojiProducts = await this.db
            .select({ categoryId: schema_1.products.categoryId })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.isNull)(schema_1.products.ownerVendorId));
        const countByCategory = new Map();
        for (const p of laojiProducts) {
            countByCategory.set(p.categoryId, (countByCategory.get(p.categoryId) ?? 0) + 1);
        }
        const byId = new Map(all.map((c) => [c.id, c]));
        const roots = all.filter((c) => !c.parentId);
        return roots.map((root) => ({
            id: root.id,
            name: root.name,
            imageUrl: root.imageUrl,
            businessType: (0, catalog_types_1.categoryBusinessType)(root, byId),
            subcategories: all
                .filter((c) => c.parentId === root.id)
                .map((sub) => ({
                id: sub.id,
                name: sub.name,
                imageUrl: sub.imageUrl,
                parentId: sub.parentId,
                businessType: (0, catalog_types_1.categoryBusinessType)(sub, byId),
                productCount: countByCategory.get(sub.id) ?? 0,
            })),
        }));
    }
    async createCategory(dto) {
        const [row] = await this.db.insert(schema_1.categories).values(dto).returning();
        return row;
    }
    async updateCategory(id, dto) {
        const updateData = {
            ...dto,
            ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
            ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
        };
        const [row] = await this.db.update(schema_1.categories).set(updateData).where((0, drizzle_orm_1.eq)(schema_1.categories.id, id)).returning();
        if (!row)
            throw new common_1.NotFoundException('Category not found');
        return row;
    }
    async deleteCategory(id) {
        const [cat] = await this.db
            .select()
            .from(schema_1.categories)
            .where((0, drizzle_orm_1.eq)(schema_1.categories.id, id))
            .limit(1);
        if (!cat)
            throw new common_1.NotFoundException('Category not found');
        if (cat.ownerVendorId !== null) {
            throw new common_1.ForbiddenException(`"${cat.name}" is a store's own category; that store manages it.`);
        }
        const [directProduct] = await this.db
            .select({ id: schema_1.products.id, name: schema_1.products.name })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.categoryId, id), (0, drizzle_orm_1.isNull)(schema_1.products.ownerVendorId)))
            .limit(1);
        if (directProduct) {
            throw new common_1.ConflictException(`Cannot delete category "${cat.name}" because it contains products. Please delete or reassign its products first.`);
        }
        const subcats = await this.db
            .select()
            .from(schema_1.categories)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.categories.parentId, id), (0, drizzle_orm_1.isNull)(schema_1.categories.ownerVendorId)));
        if (subcats.length > 0) {
            const subcatIds = subcats.map((s) => s.id);
            const [subProduct] = await this.db
                .select({ id: schema_1.products.id, name: schema_1.products.name })
                .from(schema_1.products)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.products.categoryId, subcatIds), (0, drizzle_orm_1.isNull)(schema_1.products.ownerVendorId)))
                .limit(1);
            if (subProduct) {
                throw new common_1.ConflictException(`Cannot delete category "${cat.name}" because its subcategories contain products. Please delete or reassign products first.`);
            }
        }
        const allCatIds = [id, ...subcats.map((s) => s.id)];
        await this.detachStoresFromCategories([cat, ...subcats]);
        await this.db
            .delete(schema_1.productSuggestions)
            .where((0, drizzle_orm_1.inArray)(schema_1.productSuggestions.categoryId, allCatIds));
        if (subcats.length > 0) {
            await this.db
                .delete(schema_1.categories)
                .where((0, drizzle_orm_1.inArray)(schema_1.categories.id, subcats.map((s) => s.id)));
        }
        await this.db.delete(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.id, id));
        return { success: true, message: `Category "${cat.name}" deleted successfully.` };
    }
    async detachStoresFromCategories(deleted) {
        const deletedIds = deleted.map((c) => c.id);
        const stranded = await this.db
            .selectDistinct({ vendorId: schema_1.products.ownerVendorId, categoryId: schema_1.products.categoryId })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.products.categoryId, deletedIds), (0, drizzle_orm_1.sql) `${schema_1.products.ownerVendorId} is not null`));
        if (stranded.length > 0) {
            const { byId } = await this.categoryIndex();
            for (const { vendorId, categoryId } of stranded) {
                const template = deleted.find((c) => c.id === categoryId);
                let [copy] = await this.db
                    .select()
                    .from(schema_1.categories)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.categories.ownerVendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.categories.templateCategoryId, categoryId)))
                    .limit(1);
                if (!copy) {
                    [copy] = await this.db
                        .insert(schema_1.categories)
                        .values({
                        name: template.name,
                        imageUrl: template.imageUrl,
                        parentId: template.parentId && !deletedIds.includes(template.parentId) ? template.parentId : null,
                        businessType: (0, catalog_types_1.categoryBusinessType)(template, byId),
                        ownerVendorId: vendorId,
                    })
                        .returning();
                }
                await this.db
                    .update(schema_1.products)
                    .set({ categoryId: copy.id })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.ownerVendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.products.categoryId, categoryId)));
            }
        }
        await this.db
            .update(schema_1.categories)
            .set({ parentId: null })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.categories.parentId, deletedIds), (0, drizzle_orm_1.sql) `${schema_1.categories.ownerVendorId} is not null`));
    }
    listProducts(categoryId) {
        return this.db
            .select()
            .from(schema_1.products)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.status, 'active'), (0, drizzle_orm_1.isNull)(schema_1.products.ownerVendorId), categoryId ? (0, drizzle_orm_1.eq)(schema_1.products.categoryId, categoryId) : undefined));
    }
    async getProduct(id) {
        const [row] = await this.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, id)).limit(1);
        if (!row)
            throw new common_1.NotFoundException('Product not found');
        return row;
    }
    async createProduct(dto) {
        const [row] = await this.db.insert(schema_1.products).values(dto).returning();
        return row;
    }
    async updateProduct(id, dto) {
        const updateData = {
            ...dto,
            ...(dto.brand !== undefined ? { brand: dto.brand || null } : {}),
            ...(dto.description !== undefined ? { description: dto.description || null } : {}),
            ...(dto.size !== undefined ? { size: dto.size || null } : {}),
            ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
        };
        const [row] = await this.db.update(schema_1.products).set(updateData).where((0, drizzle_orm_1.eq)(schema_1.products.id, id)).returning();
        if (!row)
            throw new common_1.NotFoundException('Product not found');
        return row;
    }
    async deleteProduct(id) {
        const [prod] = await this.db
            .select()
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, id))
            .limit(1);
        if (!prod)
            throw new common_1.NotFoundException('Product not found');
        const [orderItem] = await this.db
            .select({ id: schema_1.groceryOrderItems.id })
            .from(schema_1.groceryOrderItems)
            .where((0, drizzle_orm_1.eq)(schema_1.groceryOrderItems.productId, id))
            .limit(1);
        if (orderItem) {
            throw new common_1.ConflictException(`Cannot delete product "${prod.name}" because it is linked to existing customer orders. Please set its status to inactive instead.`);
        }
        await this.db
            .update(schema_1.productSuggestions)
            .set({ productId: null })
            .where((0, drizzle_orm_1.eq)(schema_1.productSuggestions.productId, id));
        const listings = await this.db.select().from(schema_1.vendorProducts).where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, id));
        if (prod.ownerVendorId === null) {
            for (const listing of listings) {
                const copies = await this.ownCategoryCopies(listing.vendorId);
                const copy = await this.copyProductForStore(listing.vendorId, prod, {}, (0, catalog_ownership_1.shopCategoryId)(prod.categoryId, copies));
                await this.db.update(schema_1.vendorProducts).set({ productId: copy.id }).where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, listing.id));
            }
        }
        else if (listings.length > 0) {
            await this.db.delete(schema_1.vendorProducts).where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, id));
        }
        await this.db.delete(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, id));
        return { success: true, message: `Product "${prod.name}" deleted successfully.` };
    }
    async categoryIndex() {
        const all = await this.listCategoriesFlat();
        return { all, byId: new Map(all.map((c) => [c.id, c])) };
    }
    async ownCategoryCopies(vendorId) {
        const own = await this.db.select().from(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.ownerVendorId, vendorId));
        return (0, catalog_ownership_1.ownCopiesByTemplate)(own, vendorId);
    }
    async vendorCategories(vendor) {
        const { all, byId } = await this.categoryIndex();
        const copies = (0, catalog_ownership_1.ownCopiesByTemplate)(all, vendor.id);
        return {
            all,
            byId,
            copies,
            shopKey: (categoryId) => (0, catalog_ownership_1.shopCategoryId)(categoryId, copies),
            isTemplateFor: (c) => c.ownerVendorId === null && (0, catalog_types_1.isCategoryVisibleTo)((0, catalog_types_1.categoryBusinessType)(c, byId), vendor.businessType),
            usable: (categoryId) => {
                const c = byId.get(categoryId);
                if (!c || (c.ownerVendorId !== null && c.ownerVendorId !== vendor.id)) {
                    throw new common_1.NotFoundException('Category not found');
                }
                return (0, catalog_ownership_1.shopCategoryId)(c.id, copies);
            },
        };
    }
    async listVendorCategories(vendor) {
        const [scope, listed] = await Promise.all([
            this.vendorCategories(vendor),
            this.db
                .select({ categoryId: schema_1.products.categoryId })
                .from(schema_1.vendorProducts)
                .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
                .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendor.id)),
        ]);
        const counts = new Map();
        for (const { categoryId } of listed) {
            const key = scope.shopKey(categoryId);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const parentIds = new Set(scope.all.map((c) => c.parentId));
        const view = (c, isOwn) => {
            const productCount = counts.get(c.id) ?? 0;
            return { ...c, isOwn, inShop: isOwn || productCount > 0, productCount };
        };
        const own = scope.all.filter((c) => c.ownerVendorId === vendor.id).map((c) => view(c, true));
        const laoji = scope.all
            .filter((c) => c.ownerVendorId === null &&
            !scope.copies.has(c.id) &&
            (counts.has(c.id) || (scope.isTemplateFor(c) && !parentIds.has(c.id))))
            .map((c) => view(c, false));
        return [...own, ...laoji].sort((a, b) => Number(b.inShop) - Number(a.inShop) || a.name.localeCompare(b.name));
    }
    async businessTypeRoot(businessType) {
        const rootName = catalog_types_1.BUSINESS_TYPE_ROOT_CATEGORY[businessType];
        if (!rootName) {
            throw new common_1.BadRequestException('Restaurants manage menu categories from the menu screen');
        }
        let [root] = await this.db
            .select()
            .from(schema_1.categories)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.isNull)(schema_1.categories.parentId), (0, drizzle_orm_1.isNull)(schema_1.categories.ownerVendorId), (0, drizzle_orm_1.eq)(schema_1.categories.businessType, businessType), (0, drizzle_orm_1.ilike)(schema_1.categories.name, rootName)))
            .limit(1);
        if (!root) {
            [root] = await this.db.insert(schema_1.categories).values({ name: rootName, businessType }).returning();
        }
        return root;
    }
    async createVendorCategory(vendor, dto) {
        if (!catalog_types_1.BUSINESS_TYPE_ROOT_CATEGORY[vendor.businessType]) {
            throw new common_1.BadRequestException('Restaurants manage menu categories from the menu screen');
        }
        const scope = await this.vendorCategories(vendor);
        let template;
        if (dto.templateCategoryId) {
            template = scope.byId.get(dto.templateCategoryId);
            if (!template || template.ownerVendorId !== null)
                throw new common_1.NotFoundException('Category not found');
            const copy = scope.copies.get(template.id);
            if (copy)
                return copy;
        }
        const name = (dto.name ?? template?.name ?? '').trim();
        if (!name)
            throw new common_1.BadRequestException('Category name is required');
        const existing = scope.all.find((c) => c.ownerVendorId === vendor.id && sameName(c.name, name));
        if (existing) {
            if (!template || existing.templateCategoryId === template.id)
                return existing;
            if (existing.templateCategoryId) {
                throw new common_1.ConflictException(`Your store already has a category named "${name}"`);
            }
            const [linked] = await this.db
                .update(schema_1.categories)
                .set({ templateCategoryId: template.id })
                .where((0, drizzle_orm_1.eq)(schema_1.categories.id, existing.id))
                .returning();
            await this.moveOwnProducts(vendor.id, template.id, linked.id);
            return linked;
        }
        if (!template) {
            const parentIds = new Set(scope.all.map((c) => c.parentId));
            template = scope.all.find((c) => scope.isTemplateFor(c) && !parentIds.has(c.id) && !scope.copies.has(c.id) && sameName(c.name, name));
        }
        const [created] = await this.db
            .insert(schema_1.categories)
            .values(template
            ? {
                name,
                parentId: template.parentId,
                imageUrl: template.imageUrl,
                businessType: (0, catalog_types_1.categoryBusinessType)(template, scope.byId),
                ownerVendorId: vendor.id,
                templateCategoryId: template.id,
            }
            : {
                name,
                parentId: (await this.businessTypeRoot(vendor.businessType)).id,
                businessType: vendor.businessType,
                ownerVendorId: vendor.id,
            })
            .returning();
        if (template)
            await this.moveOwnProducts(vendor.id, template.id, created.id);
        return created;
    }
    moveOwnProducts(vendorId, fromCategoryId, toCategoryId) {
        return this.db
            .update(schema_1.products)
            .set({ categoryId: toCategoryId })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.ownerVendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.products.categoryId, fromCategoryId)));
    }
    async renameVendorCategory(vendor, id, name) {
        const scope = await this.vendorCategories(vendor);
        const category = scope.byId.get(id);
        if (!category || (category.ownerVendorId !== null && category.ownerVendorId !== vendor.id)) {
            throw new common_1.NotFoundException('Category not found');
        }
        const trimmed = name.trim();
        if (!trimmed)
            throw new common_1.BadRequestException('Category name is required');
        const target = category.ownerVendorId === null ? scope.copies.get(category.id) : category;
        if (!target)
            return this.createVendorCategory(vendor, { templateCategoryId: category.id, name: trimmed });
        const clash = scope.all.find((c) => c.ownerVendorId === vendor.id && c.id !== target.id && sameName(c.name, trimmed));
        if (clash)
            throw new common_1.ConflictException(`Your store already has a category named "${trimmed}"`);
        const [updated] = await this.db
            .update(schema_1.categories)
            .set({ name: trimmed })
            .where((0, drizzle_orm_1.eq)(schema_1.categories.id, target.id))
            .returning();
        return updated;
    }
    async deleteVendorCategory(vendor, id) {
        const scope = await this.vendorCategories(vendor);
        const category = scope.byId.get(id);
        if (!category || (category.ownerVendorId !== null && category.ownerVendorId !== vendor.id)) {
            throw new common_1.NotFoundException('Category not found');
        }
        if (category.ownerVendorId === null) {
            throw new common_1.ForbiddenException(`"${category.name}" is a Laoji category, so it can't be deleted. You can rename it for your store.`);
        }
        const listed = await this.db
            .select({ categoryId: schema_1.products.categoryId })
            .from(schema_1.vendorProducts)
            .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendor.id));
        const count = listed.filter((l) => scope.shopKey(l.categoryId) === category.id).length;
        if (count > 0) {
            throw new common_1.ConflictException(`"${category.name}" still has ${count} ${count === 1 ? 'product' : 'products'}. Move ${count === 1 ? 'it' : 'them'} to another category or remove ${count === 1 ? 'it' : 'them'} from your store first.`);
        }
        const fallback = category.templateCategoryId ?? category.parentId ?? (await this.businessTypeRoot(vendor.businessType)).id;
        await this.db.update(schema_1.products).set({ categoryId: fallback }).where((0, drizzle_orm_1.eq)(schema_1.products.categoryId, category.id));
        await this.db.delete(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.id, category.id));
        return { success: true, message: `Category "${category.name}" deleted.` };
    }
    async listVendorCatalogProducts(vendor, categoryId) {
        const scope = await this.vendorCategories(vendor);
        const filterCategory = categoryId ? scope.byId.get(categoryId) : undefined;
        const filterId = filterCategory?.ownerVendorId === vendor.id ? filterCategory.templateCategoryId : categoryId;
        if (categoryId && !filterId)
            return [];
        const [rows, listings] = await Promise.all([
            this.listProducts(filterId ?? undefined),
            this.db
                .select({
                id: schema_1.vendorProducts.id,
                productId: schema_1.vendorProducts.productId,
                templateProductId: schema_1.products.templateProductId,
            })
                .from(schema_1.vendorProducts)
                .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
                .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendor.id)),
        ]);
        const listingIdByProduct = new Map();
        for (const l of listings) {
            listingIdByProduct.set(l.productId, l.id);
            if (l.templateProductId)
                listingIdByProduct.set(l.templateProductId, l.id);
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
    async listVendorProducts(vendorId) {
        const [rows, copies] = await Promise.all([
            this.db
                .select({ vendorProduct: schema_1.vendorProducts, product: schema_1.products })
                .from(schema_1.vendorProducts)
                .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
                .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendorId)),
            this.ownCategoryCopies(vendorId),
        ]);
        return rows.map((r) => this.listingView(vendorId, r.vendorProduct, r.product, copies));
    }
    listingView(vendorId, listing, product, copies) {
        return {
            ...listing,
            product: { ...product, categoryId: (0, catalog_ownership_1.shopCategoryId)(product.categoryId, copies) },
            isOwnProduct: product.ownerVendorId === vendorId,
        };
    }
    async listingResponse(vendorId, listing, product) {
        return this.listingView(vendorId, listing, product, await this.ownCategoryCopies(vendorId));
    }
    async assertListableBy(vendor, product) {
        if (product.ownerVendorId === vendor.id)
            return;
        if (product.ownerVendorId !== null)
            throw new common_1.ForbiddenException('This product belongs to another store');
        if (product.status !== 'active') {
            throw new common_1.BadRequestException(`"${product.name}" is no longer available in the catalog`);
        }
        const { byId } = await this.categoryIndex();
        const category = byId.get(product.categoryId);
        if (!category || !(0, catalog_types_1.isCategoryVisibleTo)((0, catalog_types_1.categoryBusinessType)(category, byId), vendor.businessType)) {
            throw new common_1.BadRequestException(`"${product.name}" is not in your store type's catalog`);
        }
    }
    async findListingOf(vendorId, product) {
        const [row] = await this.db
            .select({ listing: schema_1.vendorProducts })
            .from(schema_1.vendorProducts)
            .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendorId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, product.id), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.templateProductId, product.id), (0, drizzle_orm_1.eq)(schema_1.products.ownerVendorId, vendorId)))))
            .limit(1);
        return row?.listing;
    }
    async productForListing(vendor, product, input) {
        if (product.ownerVendorId !== null && product.ownerVendorId !== vendor.id) {
            throw new common_1.ForbiddenException('This product belongs to another store');
        }
        const scope = await this.vendorCategories(vendor);
        const details = {
            ...input,
            categoryId: input.categoryId !== undefined ? scope.usable(input.categoryId) : undefined,
            attributes: input.attributes !== undefined && vendor.businessType !== 'restaurant'
                ?
                    (0, product_forms_1.readProductAttributes)((0, product_forms_1.productFormFor)(vendor.businessType), { name: product.name, unit: product.unit, attributes: input.attributes }, { requireAll: false })
                : undefined,
        };
        const currentShopCategory = scope.shopKey(product.categoryId);
        const changes = (0, catalog_ownership_1.productDetailChanges)(product, details, (id) => id === currentShopCategory);
        if (Object.keys(changes).length === 0)
            return product;
        if (product.ownerVendorId === vendor.id) {
            const [updated] = await this.db.update(schema_1.products).set(changes).where((0, drizzle_orm_1.eq)(schema_1.products.id, product.id)).returning();
            return updated;
        }
        return this.copyProductForStore(vendor.id, product, changes, currentShopCategory);
    }
    async copyProductForStore(vendorId, template, changes, categoryId) {
        const [copy] = await this.db
            .insert(schema_1.products)
            .values({
            categoryId,
            brand: template.brand,
            name: template.name,
            description: template.description,
            unit: template.unit,
            size: template.size,
            mrp: template.mrp,
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
    normalizeRestockEta(listing) {
        return listing.stockQty > 0 && listing.isAvailable ? null : listing.restockEta;
    }
    assertRestockEtaNotPast(restockEta) {
        if (restockEta && restockEta < (0, catalog_types_1.istDateString)()) {
            throw new common_1.BadRequestException('Restock date cannot be in the past');
        }
    }
    async upsertVendorProduct(vendor, dto) {
        const product = await this.getProduct(dto.productId);
        const existing = await this.findListingOf(vendor.id, product);
        if (existing)
            return this.updateVendorProduct(vendor, existing.id, dto);
        this.assertRestockEtaNotPast(dto.restockEta);
        await this.assertListableBy(vendor, product);
        const listed = await this.productForListing(vendor, product, dto);
        const isAvailable = dto.isAvailable ?? true;
        const [created] = await this.db
            .insert(schema_1.vendorProducts)
            .values({
            vendorId: vendor.id,
            productId: listed.id,
            price: dto.price,
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
    async createVendorProduct(vendor, dto) {
        this.assertRestockEtaNotPast(dto.restockEta);
        const scope = await this.vendorCategories(vendor);
        const categoryId = scope.usable(dto.categoryId);
        const attributes = dto.attributes === undefined
            ? null
            : (0, catalog_ownership_1.normalizeAttributes)((0, product_forms_1.readProductAttributes)((0, product_forms_1.productFormFor)(vendor.businessType), { ...dto, attributes: dto.attributes }));
        const product = await this.createProduct({
            categoryId,
            name: dto.name.trim(),
            brand: dto.brand?.trim() || undefined,
            unit: dto.unit.trim(),
            size: dto.size?.trim() || undefined,
            mrp: dto.mrp,
            imageUrl: dto.imageUrl || undefined,
            description: dto.description?.trim() || undefined,
            attributes,
            ownerVendorId: vendor.id,
        });
        const isAvailable = dto.isAvailable ?? true;
        const [listing] = await this.db
            .insert(schema_1.vendorProducts)
            .values({
            vendorId: vendor.id,
            productId: product.id,
            price: dto.price,
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
    async requireOwnVendorProduct(vendorId, id) {
        const [row] = await this.db.select().from(schema_1.vendorProducts).where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, id)).limit(1);
        if (!row)
            throw new common_1.NotFoundException('Listing not found');
        if (row.vendorId !== vendorId)
            throw new common_1.ForbiddenException('Not your listing');
        return row;
    }
    async updateVendorProduct(vendor, id, dto) {
        const existing = await this.requireOwnVendorProduct(vendor.id, id);
        this.assertRestockEtaNotPast(dto.restockEta);
        const product = await this.productForListing(vendor, await this.getProduct(existing.productId), dto);
        const stockQty = dto.stockQty ?? existing.stockQty;
        const isAvailable = dto.isAvailable ?? existing.isAvailable;
        const restockEta = dto.restockEta !== undefined ? dto.restockEta : existing.restockEta;
        const [updated] = await this.db
            .update(schema_1.vendorProducts)
            .set({
            ...(product.id !== existing.productId ? { productId: product.id } : {}),
            ...(dto.price !== undefined ? { price: dto.price } : {}),
            stockQty,
            isAvailable,
            ...(dto.offerTag !== undefined ? { offerTag: dto.offerTag || null } : {}),
            ...(dto.lowStockThreshold !== undefined ? { lowStockThreshold: dto.lowStockThreshold } : {}),
            restockEta: this.normalizeRestockEta({ stockQty, isAvailable, restockEta }),
            ...(stockQty > existing.stockQty ? { lastRestockedAt: new Date() } : {}),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, id))
            .returning();
        return this.listingResponse(vendor.id, updated, product);
    }
    async restockVendorProduct(vendorId, id, qty) {
        await this.requireOwnVendorProduct(vendorId, id);
        const [updated] = await this.db
            .update(schema_1.vendorProducts)
            .set({
            stockQty: (0, drizzle_orm_1.sql) `${schema_1.vendorProducts.stockQty} + ${qty}`,
            isAvailable: true,
            restockEta: null,
            lastRestockedAt: new Date(),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, id))
            .returning();
        const product = await this.getProduct(updated.productId);
        return this.listingResponse(vendorId, updated, product);
    }
    async deleteVendorProduct(vendorId, id) {
        const row = await this.requireOwnVendorProduct(vendorId, id);
        await this.db.delete(schema_1.vendorProducts).where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, id));
        const product = await this.getProduct(row.productId);
        if (product.ownerVendorId === vendorId) {
            const [orderItem] = await this.db
                .select({ id: schema_1.groceryOrderItems.id })
                .from(schema_1.groceryOrderItems)
                .where((0, drizzle_orm_1.eq)(schema_1.groceryOrderItems.productId, product.id))
                .limit(1);
            if (!orderItem)
                await this.db.delete(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, product.id));
        }
        return { success: true };
    }
    async createVendorCustomProduct(vendor, dto) {
        const scope = await this.vendorCategories(vendor);
        const stockQty = dto.stockQty ?? 0;
        const [product] = await this.db
            .insert(schema_1.products)
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
            .insert(schema_1.vendorProducts)
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
    async requireListingOfProduct(vendorId, productId) {
        const [listing] = await this.db
            .select()
            .from(schema_1.vendorProducts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, productId)))
            .limit(1);
        if (!listing)
            throw new common_1.NotFoundException('Product listing not found');
        return listing;
    }
    async updateVendorCustomProduct(vendor, productId, dto) {
        const listing = await this.requireListingOfProduct(vendor.id, productId);
        return this.updateVendorProduct(vendor, listing.id, dto);
    }
    async deleteVendorCustomProduct(vendorId, productId) {
        const listing = await this.requireListingOfProduct(vendorId, productId);
        return this.deleteVendorProduct(vendorId, listing.id);
    }
    async vendorsInRadius(lat, lng) {
        const allVendors = await this.db.select().from(schema_1.vendors);
        return allVendors.filter((v) => (0, catalog_types_1.isVendorOpenNow)(v) && (0, catalog_types_1.haversineKm)(lat, lng, v.pickupLat, v.pickupLng) <= v.radiusKm);
    }
    async publicListProducts(lat, lng, categoryId) {
        const inRadius = await this.vendorsInRadius(lat, lng);
        const vendorIds = inRadius.map((v) => v.id);
        if (vendorIds.length === 0)
            return [];
        const { all, byId } = await this.categoryIndex();
        const categoryIds = categoryId
            ? [categoryId, ...all.filter((c) => c.ownerVendorId !== null && c.templateCategoryId === categoryId).map((c) => c.id)]
            : undefined;
        const rows = await this.db
            .select({ vendorProduct: schema_1.vendorProducts, product: schema_1.products })
            .from(schema_1.vendorProducts)
            .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.vendorProducts.vendorId, vendorIds), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.isAvailable, true), (0, drizzle_orm_1.eq)(schema_1.products.status, 'active'), categoryIds ? (0, drizzle_orm_1.inArray)(schema_1.products.categoryId, categoryIds) : undefined));
        return this.aggregateByProduct(rows, byId);
    }
    async customerCategoryId(categoryId) {
        const { byId } = await this.categoryIndex();
        return (0, catalog_ownership_1.laojiCategoryId)(categoryId, byId);
    }
    async publicGetProduct(id, lat, lng) {
        const product = await this.getProduct(id);
        const { byId } = await this.categoryIndex();
        const inRadius = await this.vendorsInRadius(lat, lng);
        const vendorIds = inRadius.map((v) => v.id);
        const rows = vendorIds.length === 0
            ? []
            : await this.db
                .select({ vendorProduct: schema_1.vendorProducts, product: schema_1.products })
                .from(schema_1.vendorProducts)
                .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, id), (0, drizzle_orm_1.inArray)(schema_1.vendorProducts.vendorId, vendorIds), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.isAvailable, true)));
        const [aggregated] = this.aggregateByProduct(rows, byId);
        return {
            ...product,
            categoryId: (0, catalog_ownership_1.laojiCategoryId)(product.categoryId, byId),
            price: aggregated?.price ?? null,
            inStock: aggregated?.inStock ?? false,
            restockEta: aggregated?.restockEta ?? null,
        };
    }
    aggregateByProduct(rows, categoriesById) {
        const today = (0, catalog_types_1.istDateString)();
        const byProduct = new Map();
        for (const { vendorProduct, product } of rows) {
            const inStock = vendorProduct.stockQty > 0;
            const eta = !inStock && vendorProduct.restockEta && vendorProduct.restockEta >= today ? vendorProduct.restockEta : null;
            const current = byProduct.get(product.id);
            if (!current) {
                byProduct.set(product.id, { product, price: vendorProduct.price, inStock, restockEta: eta });
                continue;
            }
            if (inStock ? !current.inStock || vendorProduct.price < current.price : !current.inStock && vendorProduct.price < current.price) {
                current.price = vendorProduct.price;
            }
            current.inStock ||= inStock;
            if (eta && (!current.restockEta || eta < current.restockEta))
                current.restockEta = eta;
        }
        return [...byProduct.values()].map(({ product, price, inStock, restockEta }) => ({
            ...product,
            categoryId: (0, catalog_ownership_1.laojiCategoryId)(product.categoryId, categoriesById),
            price,
            inStock,
            restockEta: inStock ? null : restockEta,
        }));
    }
    async publicListRestaurants(lat, lng) {
        const allVendors = await this.db.select().from(schema_1.vendors);
        const distanceKm = new Map(allVendors.map((v) => [v.id, (0, catalog_types_1.haversineKm)(lat, lng, v.pickupLat, v.pickupLng)]));
        const nearbyVendors = allVendors.filter((v) => v.isOpen && distanceKm.get(v.id) <= v.radiusKm);
        const vendorMap = new Map(nearbyVendors.map((v) => [v.id, v]));
        const vendorIds = nearbyVendors.filter((v) => v.type !== 'grocery').map((v) => v.id);
        if (vendorIds.length === 0)
            return [];
        const rows = await this.db
            .select()
            .from(schema_1.restaurants)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.restaurants.vendorId, vendorIds), (0, drizzle_orm_1.eq)(schema_1.restaurants.isOpen, true)));
        const restIds = rows.map((r) => r.id);
        const ratingsMap = new Map();
        if (restIds.length > 0) {
            const aggRows = await this.db
                .select({
                restaurantId: schema_1.foodOrderRatings.restaurantId,
                count: (0, drizzle_orm_1.sql) `count(*)::int`,
                avg: (0, drizzle_orm_1.sql) `coalesce(avg(${schema_1.foodOrderRatings.rating}), 0)::float`,
            })
                .from(schema_1.foodOrderRatings)
                .where((0, drizzle_orm_1.inArray)(schema_1.foodOrderRatings.restaurantId, restIds))
                .groupBy(schema_1.foodOrderRatings.restaurantId);
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
            const openNow = r.isOpen && (v ? (0, catalog_types_1.isVendorOpenNow)(v) : false);
            const agg = ratingsMap.get(r.id);
            const dynamicRating = agg && agg.count > 0 ? agg.avg : (r.ratingAvg > 0 ? Math.round(r.ratingAvg * 10) / 10 : 4.8);
            const dynamicCount = agg ? agg.count : 0;
            return {
                ...r,
                mealTimings: (0, meal_slots_1.mealTimingsView)(r.mealTimings),
                imageUrl: r.imageUrl || v?.imageUrl || null,
                ratingAvg: dynamicRating,
                ratingCount: dynamicCount,
                isOpen: openNow,
                distanceKm: (0, catalog_types_1.roundKm)(distanceKm.get(r.vendorId)),
            };
        })
            .sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || a.distanceKm - b.distanceKm);
    }
    async publicGetRestaurant(id, near) {
        const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, id)).limit(1);
        if (!restaurant)
            throw new common_1.NotFoundException('Restaurant not found');
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, restaurant.vendorId)).limit(1);
        const openNow = restaurant.isOpen && (vendor ? (0, catalog_types_1.isVendorOpenNow)(vendor) : false);
        const distanceKm = near && vendor ? (0, catalog_types_1.haversineKm)(near.lat, near.lng, vendor.pickupLat, vendor.pickupLng) : null;
        const timings = (0, meal_slots_1.effectiveMealTimings)(restaurant.mealTimings);
        const now = new Date();
        const [ratingsAgg] = await this.db
            .select({
            count: (0, drizzle_orm_1.sql) `count(*)::int`,
            avg: (0, drizzle_orm_1.sql) `coalesce(avg(${schema_1.foodOrderRatings.rating}), 0)::float`,
        })
            .from(schema_1.foodOrderRatings)
            .where((0, drizzle_orm_1.eq)(schema_1.foodOrderRatings.restaurantId, id));
        const dynamicRating = ratingsAgg && Number(ratingsAgg.count) > 0
            ? Math.round(Number(ratingsAgg.avg) * 10) / 10
            : (restaurant.ratingAvg > 0 ? Math.round(restaurant.ratingAvg * 10) / 10 : 4.8);
        const dynamicCount = ratingsAgg ? Number(ratingsAgg.count) : 0;
        const cats = await this.db
            .select()
            .from(schema_1.menuCategories)
            .where((0, drizzle_orm_1.eq)(schema_1.menuCategories.restaurantId, id));
        const items = cats.length
            ? await this.db
                .select()
                .from(schema_1.menuItems)
                .where((0, drizzle_orm_1.inArray)(schema_1.menuItems.menuCategoryId, cats.map((c) => c.id)))
            : [];
        const itemIds = items.map((i) => i.id);
        const addons = itemIds.length
            ? await this.db.select().from(schema_1.menuItemAddons).where((0, drizzle_orm_1.inArray)(schema_1.menuItemAddons.menuItemId, itemIds))
            : [];
        const variants = itemIds.length
            ? await this.db.select().from(schema_1.menuItemVariants).where((0, drizzle_orm_1.inArray)(schema_1.menuItemVariants.menuItemId, itemIds))
            : [];
        return {
            ...restaurant,
            mealTimings: (0, meal_slots_1.mealTimingsView)(restaurant.mealTimings),
            imageUrl: restaurant.imageUrl || vendor?.imageUrl || null,
            ratingAvg: dynamicRating,
            ratingCount: dynamicCount,
            isOpen: openNow,
            ...(distanceKm !== null && vendor
                ? { distanceKm: (0, catalog_types_1.roundKm)(distanceKm), deliversToYou: distanceKm <= vendor.radiusKm }
                : {}),
            menuCategories: cats.map((cat) => ({
                ...cat,
                items: items
                    .filter((i) => i.menuCategoryId === cat.id)
                    .map((item) => {
                    const servedNow = (0, meal_slots_1.isServedNow)(item.mealSlots, timings, now);
                    return {
                        ...item,
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
    async publicSearch(lat, lng, query) {
        const trimmed = query.trim();
        if (!trimmed) {
            return { products: [], restaurants: [], dishes: [] };
        }
        const inRadius = await this.vendorsInRadius(lat, lng);
        const distanceKm = new Map(inRadius.map((v) => [v.id, (0, catalog_types_1.haversineKm)(lat, lng, v.pickupLat, v.pickupLng)]));
        const productVendorIds = inRadius.filter((v) => v.type !== 'restaurant').map((v) => v.id);
        const restaurantVendorIds = inRadius.filter((v) => v.type !== 'grocery').map((v) => v.id);
        let productsList = [];
        if (productVendorIds.length > 0) {
            const pRows = await this.db
                .select({ vendorProduct: schema_1.vendorProducts, product: schema_1.products })
                .from(schema_1.vendorProducts)
                .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.vendorProducts.vendorId, productVendorIds), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.isAvailable, true), (0, drizzle_orm_1.eq)(schema_1.products.status, 'active'), (0, drizzle_orm_1.ilike)(schema_1.products.name, `%${trimmed}%`)));
            productsList = this.aggregateByProduct(pRows, (await this.categoryIndex()).byId);
        }
        let matchedRestaurants = [];
        if (restaurantVendorIds.length > 0) {
            const rows = await this.db
                .select()
                .from(schema_1.restaurants)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.restaurants.vendorId, restaurantVendorIds), (0, drizzle_orm_1.eq)(schema_1.restaurants.isOpen, true), (0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.restaurants.name, `%${trimmed}%`), (0, drizzle_orm_1.ilike)(schema_1.restaurants.cuisineTags, `%${trimmed}%`))));
            matchedRestaurants = rows
                .map((r) => ({
                ...r,
                mealTimings: (0, meal_slots_1.mealTimingsView)(r.mealTimings),
                distanceKm: (0, catalog_types_1.roundKm)(distanceKm.get(r.vendorId)),
            }))
                .sort((a, b) => a.distanceKm - b.distanceKm);
        }
        let dishesList = [];
        if (restaurantVendorIds.length > 0) {
            const activeRestaurants = await this.db
                .select()
                .from(schema_1.restaurants)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.restaurants.vendorId, restaurantVendorIds), (0, drizzle_orm_1.eq)(schema_1.restaurants.isOpen, true)));
            const restIds = activeRestaurants.map((r) => r.id);
            if (restIds.length > 0) {
                const catRows = await this.db
                    .select()
                    .from(schema_1.menuCategories)
                    .where((0, drizzle_orm_1.inArray)(schema_1.menuCategories.restaurantId, restIds));
                const catIds = catRows.map((c) => c.id);
                if (catIds.length > 0) {
                    const restMap = new Map(activeRestaurants.map((r) => [r.id, r]));
                    const catMap = new Map(catRows.map((c) => [c.id, c.restaurantId]));
                    const timingsByRestaurant = new Map(activeRestaurants.map((r) => [r.id, (0, meal_slots_1.effectiveMealTimings)(r.mealTimings)]));
                    const now = new Date();
                    const itemRows = await this.db
                        .select()
                        .from(schema_1.menuItems)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.menuItems.menuCategoryId, catIds), (0, drizzle_orm_1.eq)(schema_1.menuItems.isAvailable, true), (0, drizzle_orm_1.ilike)(schema_1.menuItems.name, `%${trimmed}%`)));
                    dishesList = itemRows
                        .filter((item) => (0, meal_slots_1.isServedNow)(item.mealSlots, timingsByRestaurant.get(catMap.get(item.menuCategoryId)), now))
                        .map((item) => {
                        const rId = catMap.get(item.menuCategoryId);
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
    async getOrCreateRestaurant(vendorId) {
        const [existing] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, vendorId)).limit(1);
        if (existing)
            return existing;
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendorId)).limit(1);
        if (!vendor)
            throw new common_1.NotFoundException('Vendor not found');
        const [created] = await this.db.insert(schema_1.restaurants).values({ vendorId, name: vendor.businessName }).returning();
        return created;
    }
    async recalcRestaurantRating(restaurantId) {
        const rows = await this.db
            .select({ rating: schema_1.foodOrderRatings.rating })
            .from(schema_1.foodOrderRatings)
            .where((0, drizzle_orm_1.eq)(schema_1.foodOrderRatings.restaurantId, restaurantId));
        const avg = rows.length ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length : 0;
        await this.db
            .update(schema_1.restaurants)
            .set({ ratingAvg: Math.round(avg * 10) / 10 })
            .where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, restaurantId));
    }
    async updateRestaurant(vendorId, dto) {
        const restaurant = await this.getOrCreateRestaurant(vendorId);
        const [updated] = await this.db
            .update(schema_1.restaurants)
            .set(dto)
            .where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, restaurant.id))
            .returning();
        return updated;
    }
    async getMealTimings(vendorId) {
        const restaurant = await this.getOrCreateRestaurant(vendorId);
        return (0, meal_slots_1.mealTimingsView)(restaurant.mealTimings);
    }
    async updateMealTimings(vendorId, dto) {
        (0, meal_slots_1.validateMealTimings)(dto.timings);
        const restaurant = await this.getOrCreateRestaurant(vendorId);
        const [updated] = await this.db
            .update(schema_1.restaurants)
            .set({ mealTimings: dto.timings.map(({ slot, start, end }) => ({ slot, start, end })) })
            .where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, restaurant.id))
            .returning();
        return (0, meal_slots_1.mealTimingsView)(updated.mealTimings);
    }
    async listMenuCategories(vendorId) {
        const restaurant = await this.getOrCreateRestaurant(vendorId);
        return this.db.select().from(schema_1.menuCategories).where((0, drizzle_orm_1.eq)(schema_1.menuCategories.restaurantId, restaurant.id));
    }
    async createMenuCategory(vendorId, dto) {
        const restaurant = await this.getOrCreateRestaurant(vendorId);
        const [row] = await this.db
            .insert(schema_1.menuCategories)
            .values({ restaurantId: restaurant.id, name: dto.name, sortOrder: dto.sortOrder ?? 0 })
            .returning();
        return row;
    }
    async requireOwnMenuCategory(vendorId, id) {
        const restaurant = await this.getOrCreateRestaurant(vendorId);
        const [row] = await this.db.select().from(schema_1.menuCategories).where((0, drizzle_orm_1.eq)(schema_1.menuCategories.id, id)).limit(1);
        if (!row || row.restaurantId !== restaurant.id)
            throw new common_1.NotFoundException('Menu category not found');
        return row;
    }
    async updateMenuCategory(vendorId, id, dto) {
        await this.requireOwnMenuCategory(vendorId, id);
        const [updated] = await this.db.update(schema_1.menuCategories).set(dto).where((0, drizzle_orm_1.eq)(schema_1.menuCategories.id, id)).returning();
        return updated;
    }
    async deleteMenuCategory(vendorId, id) {
        await this.requireOwnMenuCategory(vendorId, id);
        await this.db.delete(schema_1.menuCategories).where((0, drizzle_orm_1.eq)(schema_1.menuCategories.id, id));
    }
    async listMenuItems(vendorId, menuCategoryId) {
        const restaurant = await this.getOrCreateRestaurant(vendorId);
        const cats = await this.db.select().from(schema_1.menuCategories).where((0, drizzle_orm_1.eq)(schema_1.menuCategories.restaurantId, restaurant.id));
        const catIds = cats.map((c) => c.id);
        if (catIds.length === 0)
            return [];
        const items = await this.db
            .select()
            .from(schema_1.menuItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.menuItems.menuCategoryId, catIds), menuCategoryId ? (0, drizzle_orm_1.eq)(schema_1.menuItems.menuCategoryId, menuCategoryId) : undefined));
        const itemIds = items.map((i) => i.id);
        const addons = itemIds.length
            ? await this.db.select().from(schema_1.menuItemAddons).where((0, drizzle_orm_1.inArray)(schema_1.menuItemAddons.menuItemId, itemIds))
            : [];
        const variants = itemIds.length
            ? await this.db.select().from(schema_1.menuItemVariants).where((0, drizzle_orm_1.inArray)(schema_1.menuItemVariants.menuItemId, itemIds))
            : [];
        return items.map((item) => ({
            ...item,
            addons: addons.filter((a) => a.menuItemId === item.id),
            variants: variants.filter((v) => v.menuItemId === item.id),
        }));
    }
    async createMenuItem(vendorId, dto) {
        await this.requireOwnMenuCategory(vendorId, dto.menuCategoryId);
        const [item] = await this.db
            .insert(schema_1.menuItems)
            .values({
            menuCategoryId: dto.menuCategoryId,
            name: dto.name,
            description: dto.description,
            price: dto.price,
            imageUrl: dto.imageUrl,
            isVeg: dto.isVeg ?? true,
            mealSlots: (0, meal_slots_1.normalizeMealSlots)(dto.mealSlots),
        })
            .returning();
        const addons = await this.replaceAddons(item.id, dto.addons);
        const variants = await this.replaceVariants(item.id, dto.variants);
        return { ...item, addons, variants };
    }
    async requireOwnMenuItem(vendorId, id) {
        const restaurant = await this.getOrCreateRestaurant(vendorId);
        const [row] = await this.db.select().from(schema_1.menuItems).where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id)).limit(1);
        if (!row)
            throw new common_1.NotFoundException('Menu item not found');
        const [cat] = await this.db.select().from(schema_1.menuCategories).where((0, drizzle_orm_1.eq)(schema_1.menuCategories.id, row.menuCategoryId)).limit(1);
        if (!cat || cat.restaurantId !== restaurant.id)
            throw new common_1.ForbiddenException('Not your menu item');
        return row;
    }
    async updateMenuItem(vendorId, id, dto) {
        await this.requireOwnMenuItem(vendorId, id);
        const { addons, variants, mealSlots, ...fields } = dto;
        const updateData = {
            ...fields,
            ...(fields.imageUrl !== undefined ? { imageUrl: fields.imageUrl || null } : {}),
            ...(fields.description !== undefined ? { description: fields.description || null } : {}),
            ...(mealSlots !== undefined ? { mealSlots: (0, meal_slots_1.normalizeMealSlots)(mealSlots) } : {}),
        };
        const [updated] = await this.db.update(schema_1.menuItems).set(updateData).where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id)).returning();
        const finalAddons = addons !== undefined
            ? await this.replaceAddons(id, addons)
            : await this.db.select().from(schema_1.menuItemAddons).where((0, drizzle_orm_1.eq)(schema_1.menuItemAddons.menuItemId, id));
        const finalVariants = variants !== undefined
            ? await this.replaceVariants(id, variants)
            : await this.db.select().from(schema_1.menuItemVariants).where((0, drizzle_orm_1.eq)(schema_1.menuItemVariants.menuItemId, id));
        return { ...updated, addons: finalAddons, variants: finalVariants };
    }
    async deleteMenuItem(vendorId, id) {
        await this.requireOwnMenuItem(vendorId, id);
        await this.db.delete(schema_1.menuItems).where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id));
    }
    async replaceAddons(menuItemId, addons) {
        await this.db.delete(schema_1.menuItemAddons).where((0, drizzle_orm_1.eq)(schema_1.menuItemAddons.menuItemId, menuItemId));
        if (!addons || addons.length === 0)
            return [];
        return this.db
            .insert(schema_1.menuItemAddons)
            .values(addons.map((a) => ({ menuItemId, name: a.name, price: a.price, isRequired: a.isRequired ?? false })))
            .returning();
    }
    async replaceVariants(menuItemId, variants) {
        await this.db.delete(schema_1.menuItemVariants).where((0, drizzle_orm_1.eq)(schema_1.menuItemVariants.menuItemId, menuItemId));
        if (!variants || variants.length === 0)
            return [];
        return this.db
            .insert(schema_1.menuItemVariants)
            .values(variants.map((v) => ({
            menuItemId,
            name: v.name,
            priceDelta: v.priceDelta,
            isDefault: v.isDefault ?? false,
        })))
            .returning();
    }
    async createProductSuggestion(vendor, dto) {
        const { byId } = await this.categoryIndex();
        const category = byId.get(dto.categoryId);
        if (!category || (category.ownerVendorId !== null && category.ownerVendorId !== vendor.id)) {
            throw new common_1.NotFoundException('Category not found');
        }
        const categoryId = (0, catalog_ownership_1.laojiCategoryId)(category.id, byId);
        if (byId.get(categoryId)?.ownerVendorId !== null) {
            throw new common_1.BadRequestException(`"${category.name}" is your store's own category. Pick one of Laoji's categories, or suggest "${category.name}" as a new category first.`);
        }
        const [row] = await this.db
            .insert(schema_1.productSuggestions)
            .values({
            vendorId: vendor.id,
            name: dto.name.trim(),
            categoryId,
            unit: dto.unit.trim(),
            size: dto.size?.trim() || undefined,
            imageUrl: dto.imageUrl,
        })
            .returning();
        return row;
    }
    listMyProductSuggestions(vendorId) {
        return this.db
            .select()
            .from(schema_1.productSuggestions)
            .where((0, drizzle_orm_1.eq)(schema_1.productSuggestions.vendorId, vendorId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.productSuggestions.createdAt));
    }
    async listProductSuggestions(status) {
        const rows = await this.db
            .select({ suggestion: schema_1.productSuggestions, vendor: schema_1.vendors, category: schema_1.categories })
            .from(schema_1.productSuggestions)
            .innerJoin(schema_1.vendors, (0, drizzle_orm_1.eq)(schema_1.productSuggestions.vendorId, schema_1.vendors.id))
            .innerJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.productSuggestions.categoryId, schema_1.categories.id))
            .where(status ? (0, drizzle_orm_1.eq)(schema_1.productSuggestions.status, status) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.productSuggestions.createdAt));
        return rows.map(({ suggestion, vendor, category }) => ({
            ...suggestion,
            vendorName: vendor.businessName,
            categoryName: category.name,
        }));
    }
    async requirePendingSuggestion(id) {
        const [row] = await this.db.select().from(schema_1.productSuggestions).where((0, drizzle_orm_1.eq)(schema_1.productSuggestions.id, id)).limit(1);
        if (!row)
            throw new common_1.NotFoundException('Suggestion not found');
        if (row.status !== 'pending')
            throw new common_1.ConflictException('Suggestion has already been reviewed');
        return row;
    }
    async approveProductSuggestion(adminUserId, id) {
        const suggestion = await this.requirePendingSuggestion(id);
        const product = await this.createProduct({
            categoryId: suggestion.categoryId,
            name: suggestion.name,
            unit: suggestion.unit,
            size: suggestion.size ?? undefined,
            imageUrl: suggestion.imageUrl ?? undefined,
        });
        const [updated] = await this.db
            .update(schema_1.productSuggestions)
            .set({ status: 'approved', productId: product.id, reviewedBy: adminUserId, reviewedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.productSuggestions.id, id))
            .returning();
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, suggestion.vendorId)).limit(1);
        if (vendor) {
            this.notifications.notifyPush(vendor.userId, 'product_suggestion_approved', (0, product_suggestion_1.productSuggestionApprovedVendorPush)(suggestion.name));
        }
        return { ...updated, product };
    }
    async rejectProductSuggestion(adminUserId, id, reason) {
        const suggestion = await this.requirePendingSuggestion(id);
        const [updated] = await this.db
            .update(schema_1.productSuggestions)
            .set({ status: 'rejected', rejectionReason: reason, reviewedBy: adminUserId, reviewedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.productSuggestions.id, id))
            .returning();
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, suggestion.vendorId)).limit(1);
        if (vendor) {
            this.notifications.notifyPush(vendor.userId, 'product_suggestion_rejected', (0, product_suggestion_1.productSuggestionRejectedVendorPush)(suggestion.name));
        }
        return updated;
    }
    async createCategorySuggestion(vendor, dto) {
        if (!catalog_types_1.BUSINESS_TYPE_ROOT_CATEGORY[vendor.businessType]) {
            throw new common_1.BadRequestException('Restaurants manage menu categories from the menu screen');
        }
        const name = dto.name.trim();
        if (name.length < 2)
            throw new common_1.BadRequestException('Category name is required');
        const scope = await this.vendorCategories(vendor);
        const parentIds = new Set(scope.all.map((c) => c.parentId));
        const offered = scope.all.find((c) => scope.isTemplateFor(c) && !parentIds.has(c.id) && sameName(c.name, name));
        if (offered) {
            throw new common_1.ConflictException(`Laoji already has a "${offered.name}" category. Add it to your store from Laoji's categories.`);
        }
        const [pending] = await this.db
            .select({ id: schema_1.categorySuggestions.id })
            .from(schema_1.categorySuggestions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.categorySuggestions.vendorId, vendor.id), (0, drizzle_orm_1.eq)(schema_1.categorySuggestions.status, 'pending'), (0, drizzle_orm_1.sql) `lower(${schema_1.categorySuggestions.name}) = lower(${name})`))
            .limit(1);
        if (pending)
            throw new common_1.ConflictException(`You have already suggested "${name}". Laoji will review it soon.`);
        const [row] = await this.db
            .insert(schema_1.categorySuggestions)
            .values({ vendorId: vendor.id, name, businessType: vendor.businessType, note: dto.note?.trim() || null })
            .returning();
        return row;
    }
    listMyCategorySuggestions(vendorId) {
        return this.db
            .select()
            .from(schema_1.categorySuggestions)
            .where((0, drizzle_orm_1.eq)(schema_1.categorySuggestions.vendorId, vendorId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.categorySuggestions.createdAt));
    }
    async listCategorySuggestions(status) {
        const rows = await this.db
            .select({ suggestion: schema_1.categorySuggestions, vendor: schema_1.vendors })
            .from(schema_1.categorySuggestions)
            .innerJoin(schema_1.vendors, (0, drizzle_orm_1.eq)(schema_1.categorySuggestions.vendorId, schema_1.vendors.id))
            .where(status ? (0, drizzle_orm_1.eq)(schema_1.categorySuggestions.status, status) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.categorySuggestions.createdAt));
        return rows.map(({ suggestion, vendor }) => ({ ...suggestion, vendorName: vendor.businessName }));
    }
    async requirePendingCategorySuggestion(id) {
        const [row] = await this.db.select().from(schema_1.categorySuggestions).where((0, drizzle_orm_1.eq)(schema_1.categorySuggestions.id, id)).limit(1);
        if (!row)
            throw new common_1.NotFoundException('Suggestion not found');
        if (row.status !== 'pending')
            throw new common_1.ConflictException('Suggestion has already been reviewed');
        return row;
    }
    async approveCategorySuggestion(adminUserId, id, dto) {
        const suggestion = await this.requirePendingCategorySuggestion(id);
        const name = dto.name?.trim() || suggestion.name;
        let parentId;
        if (dto.parentId) {
            const [parent] = await this.db.select().from(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.id, dto.parentId)).limit(1);
            if (!parent || parent.ownerVendorId !== null)
                throw new common_1.NotFoundException('Parent category not found');
            parentId = parent.id;
        }
        else {
            parentId = (await this.businessTypeRoot(suggestion.businessType)).id;
        }
        const [existing] = await this.db
            .select()
            .from(schema_1.categories)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.isNull)(schema_1.categories.ownerVendorId), (0, drizzle_orm_1.eq)(schema_1.categories.parentId, parentId), (0, drizzle_orm_1.sql) `lower(${schema_1.categories.name}) = lower(${name})`))
            .limit(1);
        const category = existing ?? (await this.createCategory({ name, parentId }));
        const [updated] = await this.db
            .update(schema_1.categorySuggestions)
            .set({ status: 'approved', categoryId: category.id, reviewedBy: adminUserId, reviewedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.categorySuggestions.id, id))
            .returning();
        const copies = await this.ownCategoryCopies(suggestion.vendorId);
        if (!copies.has(category.id)) {
            const [own] = await this.db
                .select()
                .from(schema_1.categories)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.categories.ownerVendorId, suggestion.vendorId), (0, drizzle_orm_1.isNull)(schema_1.categories.templateCategoryId), (0, drizzle_orm_1.sql) `lower(${schema_1.categories.name}) = lower(${suggestion.name})`))
                .limit(1);
            if (own) {
                await this.db.update(schema_1.categories).set({ templateCategoryId: category.id }).where((0, drizzle_orm_1.eq)(schema_1.categories.id, own.id));
                await this.moveOwnProducts(suggestion.vendorId, category.id, own.id);
            }
        }
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, suggestion.vendorId)).limit(1);
        if (vendor) {
            this.notifications.notifyPush(vendor.userId, 'category_suggestion_approved', (0, category_suggestion_1.categorySuggestionApprovedVendorPush)(category.name));
        }
        return { ...updated, category };
    }
    async rejectCategorySuggestion(adminUserId, id, reason) {
        const suggestion = await this.requirePendingCategorySuggestion(id);
        const [updated] = await this.db
            .update(schema_1.categorySuggestions)
            .set({ status: 'rejected', rejectionReason: reason, reviewedBy: adminUserId, reviewedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.categorySuggestions.id, id))
            .returning();
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, suggestion.vendorId)).limit(1);
        if (vendor) {
            this.notifications.notifyPush(vendor.userId, 'category_suggestion_rejected', (0, category_suggestion_1.categorySuggestionRejectedVendorPush)(suggestion.name));
        }
        return updated;
    }
    async listVendorsAdmin() {
        const rows = await this.db
            .select({
            vendor: schema_1.vendors,
            user: schema_1.users,
        })
            .from(schema_1.vendors)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.vendors.userId, schema_1.users.id))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.vendors.createdAt));
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
            pickupLat: vendor.pickupLat,
            pickupLng: vendor.pickupLng,
            locationIsDefault: (0, catalog_types_1.isDefaultPickup)(vendor.pickupLat, vendor.pickupLng),
            commissionPct: 10,
            cashbackPct: 5,
            discountPct: 0,
            createdAt: vendor.createdAt,
        }));
    }
    async getAdminVendor(id) {
        const [row] = await this.db
            .select({
            vendor: schema_1.vendors,
            user: schema_1.users,
        })
            .from(schema_1.vendors)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.vendors.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.vendors.id, id))
            .limit(1);
        if (!row)
            throw new common_1.NotFoundException('Vendor not found');
        const { vendor, user } = row;
        const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, id)).limit(1);
        const vendorProds = await this.db.select().from(schema_1.vendorProducts).where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, id));
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
            pickupLat: vendor.pickupLat,
            pickupLng: vendor.pickupLng,
            locationIsDefault: (0, catalog_types_1.isDefaultPickup)(vendor.pickupLat, vendor.pickupLng),
            commissionPct: 10,
            cashbackPct: 5,
            discountPct: 0,
            rating: restaurant?.ratingAvg ?? 4.8,
            ratingCount: 12,
            productCount: vendorProds.length,
            createdAt: vendor.createdAt,
        };
    }
    async createAdminVendor(dto) {
        const phone = dto.phone.trim();
        const email = dto.email && dto.email.trim() ? dto.email.trim().toLowerCase() : null;
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
        let rand = '';
        for (let i = 0; i < 5; i++) {
            rand += chars.charAt((0, crypto_1.randomInt)(0, chars.length));
        }
        const tempPassword = `LJ#${rand}`;
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        let [user] = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.and)(email ? (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.users.phone, phone), (0, drizzle_orm_1.ilike)(schema_1.users.email, email)) : (0, drizzle_orm_1.eq)(schema_1.users.phone, phone), (0, drizzle_orm_1.eq)(schema_1.users.role, 'vendor')))
            .limit(1);
        if (!user) {
            [user] = await this.db
                .insert(schema_1.users)
                .values({
                phone,
                email,
                role: 'vendor',
                status: 'active',
                passwordHash,
                mustChangePassword: true,
            })
                .returning();
        }
        else {
            const [existingVendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, user.id)).limit(1);
            if (existingVendor) {
                throw new common_1.ConflictException(`A vendor profile already exists for phone ${phone} or email ${email ?? ''}`);
            }
            [user] = await this.db
                .update(schema_1.users)
                .set({
                phone,
                ...(email ? { email } : {}),
                passwordHash,
                mustChangePassword: true,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, user.id))
                .returning();
        }
        const kycStat = (dto.kycStatus === 'verified' || dto.kycStatus === 'rejected') ? dto.kycStatus : 'pending';
        const [vendor] = await this.db
            .insert(schema_1.vendors)
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
            pickupLat: dto.pickupLat ?? catalog_types_1.DEFAULT_PICKUP.lat,
            pickupLng: dto.pickupLng ?? catalog_types_1.DEFAULT_PICKUP.lng,
            radiusKm: dto.deliveryRadiusKm ?? 5,
            kycStatus: kycStat,
            isOpen: true,
        })
            .returning();
        if (dto.type === 'restaurant' || dto.type === 'both') {
            const [existingRest] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, vendor.id)).limit(1);
            if (!existingRest) {
                await this.db.insert(schema_1.restaurants).values({
                    vendorId: vendor.id,
                    name: dto.businessName.trim(),
                });
            }
        }
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
            }
            catch (err) {
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
            pickupLat: vendor.pickupLat,
            pickupLng: vendor.pickupLng,
            locationIsDefault: (0, catalog_types_1.isDefaultPickup)(vendor.pickupLat, vendor.pickupLng),
            commissionPct: 10,
            cashbackPct: 5,
            discountPct: 0,
            tempPassword,
            createdAt: vendor.createdAt,
        };
    }
    async updateAdminVendor(id, dto) {
        const [v] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, id)).limit(1);
        if (!v)
            throw new common_1.NotFoundException('Vendor not found');
        const updateFields = {};
        if (dto.businessName !== undefined)
            updateFields.businessName = dto.businessName;
        if (dto.ownerName !== undefined)
            updateFields.ownerName = dto.ownerName;
        if (dto.type !== undefined)
            updateFields.type = dto.type;
        if (dto.shopAddress !== undefined)
            updateFields.shopAddress = dto.shopAddress;
        if (dto.deliveryRadiusKm !== undefined)
            updateFields.radiusKm = dto.deliveryRadiusKm;
        if (dto.pickupLat !== undefined && dto.pickupLng !== undefined) {
            updateFields.pickupLat = dto.pickupLat;
            updateFields.pickupLng = dto.pickupLng;
        }
        if (dto.kycStatus !== undefined && dto.kycStatus !== 'unverified')
            updateFields.kycStatus = dto.kycStatus;
        if (dto.activity !== undefined)
            updateFields.isOpen = dto.activity === 'active';
        if (dto.isOpen !== undefined)
            updateFields.isOpen = dto.isOpen;
        if (dto.gstNumber !== undefined)
            updateFields.gstNumber = dto.gstNumber ? dto.gstNumber.trim() : null;
        if (dto.aadhaarNumber !== undefined)
            updateFields.aadhaarNumber = dto.aadhaarNumber ? dto.aadhaarNumber.trim() : null;
        if (dto.bankAccount !== undefined)
            updateFields.bankAccount = dto.bankAccount ? dto.bankAccount.trim() : null;
        if (dto.bankIfsc !== undefined)
            updateFields.bankIfsc = dto.bankIfsc ? dto.bankIfsc.trim().toUpperCase() : null;
        if (dto.upiId !== undefined)
            updateFields.upiId = dto.upiId ? dto.upiId.trim() : null;
        if (Object.keys(updateFields).length > 0) {
            await this.db.update(schema_1.vendors).set(updateFields).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, id));
            if (updateFields.isOpen !== undefined) {
                await this.db.update(schema_1.restaurants).set({ isOpen: updateFields.isOpen }).where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, id));
            }
        }
        if (dto.phone !== undefined || dto.email !== undefined) {
            const userUpdates = {};
            if (dto.phone !== undefined && dto.phone.trim())
                userUpdates.phone = dto.phone.trim();
            if (dto.email !== undefined)
                userUpdates.email = dto.email.trim() ? dto.email.trim().toLowerCase() : null;
            if (Object.keys(userUpdates).length > 0) {
                await this.db.update(schema_1.users).set(userUpdates).where((0, drizzle_orm_1.eq)(schema_1.users.id, v.userId));
            }
        }
        return this.getAdminVendor(id);
    }
    async deleteAdminVendor(id) {
        const [v] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, id)).limit(1);
        if (!v)
            throw new common_1.NotFoundException('Vendor not found');
        await this.db.delete(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, id));
        return { success: true, message: `Vendor ${id} deleted successfully.` };
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, notification_service_1.NotificationService])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map