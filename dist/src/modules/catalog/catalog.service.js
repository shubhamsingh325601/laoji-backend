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
const notification_service_1 = require("../notification/notification.service");
const product_suggestion_1 = require("../notification/templates/push/product-suggestion");
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
        if (existing) {
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
                pickupLat: dto.pickupLat,
                pickupLng: dto.pickupLng,
                ...(dto.radiusKm !== undefined ? { radiusKm: dto.radiusKm } : {}),
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
            pickupLat: dto.pickupLat,
            pickupLng: dto.pickupLng,
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
    async listCategoriesTree() {
        const all = await this.listCategoriesFlat();
        const allProducts = await this.db.select().from(schema_1.products);
        const countByCategory = new Map();
        for (const p of allProducts) {
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
        const [directProduct] = await this.db
            .select({ id: schema_1.products.id, name: schema_1.products.name })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.categoryId, id))
            .limit(1);
        if (directProduct) {
            throw new common_1.ConflictException(`Cannot delete category "${cat.name}" because it contains products. Please delete or reassign its products first.`);
        }
        const subcats = await this.db
            .select()
            .from(schema_1.categories)
            .where((0, drizzle_orm_1.eq)(schema_1.categories.parentId, id));
        if (subcats.length > 0) {
            const subcatIds = subcats.map((s) => s.id);
            const [subProduct] = await this.db
                .select({ id: schema_1.products.id, name: schema_1.products.name })
                .from(schema_1.products)
                .where((0, drizzle_orm_1.inArray)(schema_1.products.categoryId, subcatIds))
                .limit(1);
            if (subProduct) {
                throw new common_1.ConflictException(`Cannot delete category "${cat.name}" because its subcategories contain products. Please delete or reassign products first.`);
            }
        }
        const allCatIds = [id, ...subcats.map((s) => s.id)];
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
    listProducts(categoryId) {
        return this.db
            .select()
            .from(schema_1.products)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.status, 'active'), categoryId ? (0, drizzle_orm_1.eq)(schema_1.products.categoryId, categoryId) : undefined));
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
        await this.db
            .delete(schema_1.vendorProducts)
            .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, id));
        await this.db.delete(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, id));
        return { success: true, message: `Product "${prod.name}" deleted successfully.` };
    }
    async categoryIdsVisibleTo(businessType) {
        const all = await this.listCategoriesFlat();
        const byId = new Map(all.map((c) => [c.id, c]));
        return {
            all,
            visible: new Set(all.filter((c) => (0, catalog_types_1.isCategoryVisibleTo)((0, catalog_types_1.categoryBusinessType)(c, byId), businessType)).map((c) => c.id)),
        };
    }
    async listVendorCategories(vendor) {
        const { all, visible } = await this.categoryIdsVisibleTo(vendor.businessType);
        const parentIds = new Set(all.map((c) => c.parentId));
        return all.filter((c) => visible.has(c.id) && !parentIds.has(c.id));
    }
    async createVendorCategory(vendor, name) {
        const rootName = catalog_types_1.BUSINESS_TYPE_ROOT_CATEGORY[vendor.businessType];
        if (!rootName) {
            throw new common_1.BadRequestException('Restaurants manage menu categories from the menu screen');
        }
        const trimmed = name.trim();
        if (!trimmed)
            throw new common_1.BadRequestException('Category name is required');
        const existing = (await this.listVendorCategories(vendor)).find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (existing)
            return existing;
        let [root] = await this.db
            .select()
            .from(schema_1.categories)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.isNull)(schema_1.categories.parentId), (0, drizzle_orm_1.eq)(schema_1.categories.businessType, vendor.businessType), (0, drizzle_orm_1.ilike)(schema_1.categories.name, rootName)))
            .limit(1);
        if (!root) {
            [root] = await this.db
                .insert(schema_1.categories)
                .values({ name: rootName, businessType: vendor.businessType })
                .returning();
        }
        const [created] = await this.db
            .insert(schema_1.categories)
            .values({ name: trimmed, parentId: root.id, businessType: vendor.businessType })
            .returning();
        return created;
    }
    async listVendorCatalogProducts(vendor, categoryId) {
        const [{ visible }, rows] = await Promise.all([
            this.categoryIdsVisibleTo(vendor.businessType),
            this.listProducts(categoryId),
        ]);
        return rows.filter((p) => visible.has(p.categoryId));
    }
    async listVendorProducts(vendorId) {
        const rows = await this.db
            .select({ vendorProduct: schema_1.vendorProducts, product: schema_1.products })
            .from(schema_1.vendorProducts)
            .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendorId));
        return rows.map((r) => ({ ...r.vendorProduct, product: r.product }));
    }
    async upsertVendorProduct(vendorId, dto) {
        const [existing] = await this.db
            .select()
            .from(schema_1.vendorProducts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, dto.productId)))
            .limit(1);
        if (existing) {
            const [updated] = await this.db
                .update(schema_1.vendorProducts)
                .set({
                price: dto.price,
                stockQty: dto.stockQty,
                isAvailable: dto.isAvailable ?? existing.isAvailable,
                offerTag: dto.offerTag !== undefined ? dto.offerTag || null : existing.offerTag,
                lowStockThreshold: dto.lowStockThreshold !== undefined ? dto.lowStockThreshold : existing.lowStockThreshold,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, existing.id))
                .returning();
            return updated;
        }
        const [created] = await this.db
            .insert(schema_1.vendorProducts)
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
    async createVendorProduct(vendor, dto) {
        const attributes = dto.attributes === undefined
            ? null
            : (0, product_forms_1.readProductAttributes)((0, product_forms_1.productFormFor)(vendor.businessType), { ...dto, attributes: dto.attributes });
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
    async requireOwnVendorProduct(vendorId, id) {
        const [row] = await this.db.select().from(schema_1.vendorProducts).where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, id)).limit(1);
        if (!row)
            throw new common_1.NotFoundException('Listing not found');
        if (row.vendorId !== vendorId)
            throw new common_1.ForbiddenException('Not your listing');
        return row;
    }
    async updateVendorProduct(vendorId, id, dto) {
        const row = await this.requireOwnVendorProduct(vendorId, id);
        const productUpdates = {};
        if (dto.name !== undefined)
            productUpdates.name = dto.name;
        if (dto.brand !== undefined)
            productUpdates.brand = dto.brand || null;
        if (dto.categoryId !== undefined)
            productUpdates.categoryId = dto.categoryId;
        if (dto.unit !== undefined)
            productUpdates.unit = dto.unit;
        if (dto.size !== undefined)
            productUpdates.size = dto.size || null;
        if (dto.mrp !== undefined)
            productUpdates.mrp = dto.mrp;
        if (dto.imageUrl !== undefined)
            productUpdates.imageUrl = dto.imageUrl || null;
        if (dto.description !== undefined)
            productUpdates.description = dto.description || null;
        if (Object.keys(productUpdates).length > 0) {
            await this.db.update(schema_1.products).set(productUpdates).where((0, drizzle_orm_1.eq)(schema_1.products.id, row.productId));
        }
        const listingUpdates = { updatedAt: new Date() };
        if (dto.price !== undefined)
            listingUpdates.price = dto.price;
        if (dto.stockQty !== undefined)
            listingUpdates.stockQty = dto.stockQty;
        if (dto.isAvailable !== undefined)
            listingUpdates.isAvailable = dto.isAvailable;
        if (dto.offerTag !== undefined)
            listingUpdates.offerTag = dto.offerTag || null;
        if (dto.lowStockThreshold !== undefined)
            listingUpdates.lowStockThreshold = dto.lowStockThreshold;
        const [updated] = await this.db
            .update(schema_1.vendorProducts)
            .set(listingUpdates)
            .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, id))
            .returning();
        const [product] = await this.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, row.productId)).limit(1);
        return { ...updated, product };
    }
    async deleteVendorProduct(vendorId, id) {
        const row = await this.requireOwnVendorProduct(vendorId, id);
        await this.db.delete(schema_1.vendorProducts).where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, id));
        const [orderItem] = await this.db
            .select({ id: schema_1.groceryOrderItems.id })
            .from(schema_1.groceryOrderItems)
            .where((0, drizzle_orm_1.eq)(schema_1.groceryOrderItems.productId, row.productId))
            .limit(1);
        if (!orderItem) {
            const otherListings = await this.db
                .select()
                .from(schema_1.vendorProducts)
                .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, row.productId))
                .limit(1);
            if (otherListings.length === 0) {
                await this.db.delete(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, row.productId));
            }
        }
        return { success: true };
    }
    async createVendorCustomProduct(vendorId, dto) {
        const [product] = await this.db
            .insert(schema_1.products)
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
            .insert(schema_1.vendorProducts)
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
    async updateVendorCustomProduct(vendorId, productId, dto) {
        const [listing] = await this.db
            .select()
            .from(schema_1.vendorProducts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, productId)))
            .limit(1);
        if (!listing)
            throw new common_1.NotFoundException('Product listing not found');
        const productUpdates = {};
        if (dto.name !== undefined)
            productUpdates.name = dto.name;
        if (dto.brand !== undefined)
            productUpdates.brand = dto.brand || null;
        if (dto.categoryId !== undefined)
            productUpdates.categoryId = dto.categoryId;
        if (dto.unit !== undefined)
            productUpdates.unit = dto.unit;
        if (dto.size !== undefined)
            productUpdates.size = dto.size || null;
        if (dto.mrp !== undefined)
            productUpdates.mrp = dto.mrp;
        if (dto.imageUrl !== undefined)
            productUpdates.imageUrl = dto.imageUrl || null;
        if (dto.description !== undefined)
            productUpdates.description = dto.description || null;
        let updatedProduct = null;
        if (Object.keys(productUpdates).length > 0) {
            const [p] = await this.db
                .update(schema_1.products)
                .set(productUpdates)
                .where((0, drizzle_orm_1.eq)(schema_1.products.id, productId))
                .returning();
            updatedProduct = p;
        }
        else {
            updatedProduct = await this.getProduct(productId);
        }
        const listingUpdates = { updatedAt: new Date() };
        if (dto.price !== undefined)
            listingUpdates.price = dto.price;
        if (dto.stockQty !== undefined)
            listingUpdates.stockQty = dto.stockQty;
        if (dto.isAvailable !== undefined)
            listingUpdates.isAvailable = dto.isAvailable;
        const [updatedListing] = await this.db
            .update(schema_1.vendorProducts)
            .set(listingUpdates)
            .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, listing.id))
            .returning();
        return { ...updatedListing, product: updatedProduct };
    }
    async deleteVendorCustomProduct(vendorId, productId) {
        const [listing] = await this.db
            .select()
            .from(schema_1.vendorProducts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, productId)))
            .limit(1);
        if (!listing)
            throw new common_1.NotFoundException('Product listing not found');
        await this.db.delete(schema_1.vendorProducts).where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, listing.id));
        const [orderItem] = await this.db
            .select({ id: schema_1.groceryOrderItems.id })
            .from(schema_1.groceryOrderItems)
            .where((0, drizzle_orm_1.eq)(schema_1.groceryOrderItems.productId, productId))
            .limit(1);
        if (!orderItem) {
            const otherListings = await this.db
                .select()
                .from(schema_1.vendorProducts)
                .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, productId))
                .limit(1);
            if (otherListings.length === 0) {
                await this.db.delete(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, productId));
            }
        }
        return { success: true };
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
        const rows = await this.db
            .select({ vendorProduct: schema_1.vendorProducts, product: schema_1.products })
            .from(schema_1.vendorProducts)
            .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.vendorProducts.vendorId, vendorIds), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.isAvailable, true), (0, drizzle_orm_1.eq)(schema_1.products.status, 'active'), categoryId ? (0, drizzle_orm_1.eq)(schema_1.products.categoryId, categoryId) : undefined));
        return this.aggregateByProduct(rows);
    }
    async publicGetProduct(id, lat, lng) {
        const product = await this.getProduct(id);
        const inRadius = await this.vendorsInRadius(lat, lng);
        const vendorIds = inRadius.map((v) => v.id);
        const rows = vendorIds.length === 0
            ? []
            : await this.db
                .select({ vendorProduct: schema_1.vendorProducts, product: schema_1.products })
                .from(schema_1.vendorProducts)
                .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, id), (0, drizzle_orm_1.inArray)(schema_1.vendorProducts.vendorId, vendorIds), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.isAvailable, true)));
        const [aggregated] = this.aggregateByProduct(rows);
        return {
            ...product,
            price: aggregated?.price ?? null,
            inStock: !!aggregated,
        };
    }
    aggregateByProduct(rows) {
        const byProduct = new Map();
        for (const { vendorProduct, product } of rows) {
            const inStock = vendorProduct.stockQty > 0;
            const existing = byProduct.get(product.id);
            if (!existing || (inStock && vendorProduct.price < existing.price)) {
                byProduct.set(product.id, { product, price: vendorProduct.price, inStock: inStock || existing?.inStock === true });
            }
            else if (inStock) {
                existing.inStock = true;
            }
        }
        return [...byProduct.values()].map(({ product, price, inStock }) => ({ ...product, price, inStock }));
    }
    async publicListRestaurants(lat, lng) {
        const allVendors = await this.db.select().from(schema_1.vendors);
        const nearbyVendors = allVendors.filter((v) => v.isOpen && (0, catalog_types_1.haversineKm)(lat, lng, v.pickupLat, v.pickupLng) <= v.radiusKm);
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
        return rows.map((r) => {
            const v = vendorMap.get(r.vendorId);
            const openNow = r.isOpen && (v ? (0, catalog_types_1.isVendorOpenNow)(v) : false);
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
    async publicGetRestaurant(id) {
        const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, id)).limit(1);
        if (!restaurant)
            throw new common_1.NotFoundException('Restaurant not found');
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, restaurant.vendorId)).limit(1);
        const openNow = restaurant.isOpen && (vendor ? (0, catalog_types_1.isVendorOpenNow)(vendor) : false);
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
    async publicSearch(lat, lng, query) {
        const trimmed = query.trim();
        if (!trimmed) {
            return { products: [], restaurants: [], dishes: [] };
        }
        const inRadius = await this.vendorsInRadius(lat, lng);
        const groceryVendorIds = inRadius.filter((v) => (v.type === 'grocery' || v.type === 'both') && v.isOpen).map((v) => v.id);
        const restaurantVendorIds = inRadius.filter((v) => v.type !== 'grocery' && v.isOpen).map((v) => v.id);
        let productsList = [];
        if (groceryVendorIds.length > 0) {
            const pRows = await this.db
                .select({ vendorProduct: schema_1.vendorProducts, product: schema_1.products })
                .from(schema_1.vendorProducts)
                .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.vendorProducts.vendorId, groceryVendorIds), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.isAvailable, true), (0, drizzle_orm_1.eq)(schema_1.products.status, 'active'), (0, drizzle_orm_1.ilike)(schema_1.products.name, `%${trimmed}%`)));
            productsList = this.aggregateByProduct(pRows);
        }
        if (productsList.length === 0) {
            const fallbackProducts = await this.db
                .select()
                .from(schema_1.products)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.status, 'active'), (0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.products.name, `%${trimmed}%`), (0, drizzle_orm_1.ilike)(schema_1.products.description, `%${trimmed}%`), (0, drizzle_orm_1.ilike)(schema_1.products.unit, `%${trimmed}%`))))
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
        let matchedRestaurants = [];
        if (restaurantVendorIds.length > 0) {
            matchedRestaurants = await this.db
                .select()
                .from(schema_1.restaurants)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.restaurants.vendorId, restaurantVendorIds), (0, drizzle_orm_1.eq)(schema_1.restaurants.isOpen, true), (0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.restaurants.name, `%${trimmed}%`), (0, drizzle_orm_1.ilike)(schema_1.restaurants.cuisineTags, `%${trimmed}%`))));
        }
        if (matchedRestaurants.length === 0) {
            matchedRestaurants = await this.db
                .select()
                .from(schema_1.restaurants)
                .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.restaurants.name, `%${trimmed}%`), (0, drizzle_orm_1.ilike)(schema_1.restaurants.cuisineTags, `%${trimmed}%`)))
                .limit(15);
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
                    const itemRows = await this.db
                        .select()
                        .from(schema_1.menuItems)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.menuItems.menuCategoryId, catIds), (0, drizzle_orm_1.eq)(schema_1.menuItems.isAvailable, true), (0, drizzle_orm_1.ilike)(schema_1.menuItems.name, `%${trimmed}%`)));
                    dishesList = itemRows.map((item) => {
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
                        };
                    });
                }
            }
        }
        if (dishesList.length === 0) {
            const menuRows = await this.db
                .select({
                item: schema_1.menuItems,
                cat: schema_1.menuCategories,
                rest: schema_1.restaurants,
            })
                .from(schema_1.menuItems)
                .innerJoin(schema_1.menuCategories, (0, drizzle_orm_1.eq)(schema_1.menuItems.menuCategoryId, schema_1.menuCategories.id))
                .innerJoin(schema_1.restaurants, (0, drizzle_orm_1.eq)(schema_1.menuCategories.restaurantId, schema_1.restaurants.id))
                .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.menuItems.name, `%${trimmed}%`), (0, drizzle_orm_1.ilike)(schema_1.menuItems.description, `%${trimmed}%`)))
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
        const { addons, variants, ...fields } = dto;
        const updateData = {
            ...fields,
            ...(fields.imageUrl !== undefined ? { imageUrl: fields.imageUrl || null } : {}),
            ...(fields.description !== undefined ? { description: fields.description || null } : {}),
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
    async createProductSuggestion(vendorId, dto) {
        const [row] = await this.db
            .insert(schema_1.productSuggestions)
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
            pickupLat: dto.pickupLat ?? 24.924,
            pickupLng: dto.pickupLng ?? 76.283,
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