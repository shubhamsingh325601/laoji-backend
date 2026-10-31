"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrocerySizesService = exports.GROCERY_SIZES_SETTING = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
exports.GROCERY_SIZES_SETTING = 'grocery_sizes_enabled';
const FLAG_TTL_MS = 30 * 1000;
let GrocerySizesService = class GrocerySizesService {
    db;
    flag = null;
    constructor(db) {
        this.db = db;
    }
    async isEnabled() {
        if (this.flag && Date.now() - this.flag.at < FLAG_TTL_MS)
            return this.flag.value;
        let value = false;
        try {
            const [row] = await this.db
                .select({ value: schema_1.platformSettings.value })
                .from(schema_1.platformSettings)
                .where((0, drizzle_orm_1.eq)(schema_1.platformSettings.key, exports.GROCERY_SIZES_SETTING))
                .limit(1);
            value = row?.value === 'true';
        }
        catch {
            value = false;
        }
        this.flag = { value, at: Date.now() };
        return value;
    }
    async setEnabled(enabled, adminId) {
        await this.db
            .insert(schema_1.platformSettings)
            .values({
            key: exports.GROCERY_SIZES_SETTING,
            value: String(enabled),
            description: 'Lets admins sell grocery items in several sizes',
            updatedAt: new Date(),
            updatedBy: adminId || null,
        })
            .onConflictDoUpdate({
            target: schema_1.platformSettings.key,
            set: {
                value: String(enabled),
                updatedAt: new Date(),
                updatedBy: adminId || null,
            },
        });
        this.flag = { value: enabled, at: Date.now() };
        return { grocerySizes: enabled };
    }
    assertValidLabels(unit, sizes) {
        const wanted = sizes.map((s) => s.label.trim());
        if (wanted.some((l) => !l))
            throw new common_1.BadRequestException('Every size needs a name, e.g. 500g');
        const labels = [unit, ...wanted].map((l) => l.trim().toLowerCase());
        if (new Set(labels).size !== labels.length) {
            throw new common_1.BadRequestException('Each size must have a different name, including the item’s own unit');
        }
    }
    async syncSizes(vendorId, listingId, sizes) {
        const wanted = sizes.map((s) => ({ ...s, label: s.label.trim() }));
        await this.db.transaction(async (tx) => {
            const [listing] = await tx
                .select()
                .from(schema_1.vendorProducts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, listingId), (0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendorId)))
                .limit(1);
            if (!listing)
                throw new common_1.NotFoundException('Item not found in this vendor catalog');
            let [primary] = await tx
                .select()
                .from(schema_1.products)
                .where((0, drizzle_orm_1.eq)(schema_1.products.id, listing.productId))
                .limit(1);
            if (!primary)
                throw new common_1.NotFoundException('Product not found');
            this.assertValidLabels(primary.unit, wanted);
            const others = await this.siblingsAt(tx, vendorId, primary, listing.id);
            if (wanted.length === 0) {
                for (const s of others)
                    await this.removeSize(tx, s.listing, s.product);
                if (primary.variantGroupId) {
                    await tx
                        .update(schema_1.products)
                        .set({ variantGroupId: null, variantLabel: null })
                        .where((0, drizzle_orm_1.eq)(schema_1.products.id, primary.id));
                }
                return;
            }
            if (primary.ownerVendorId !== vendorId) {
                const [copy] = await tx
                    .insert(schema_1.products)
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
                    .update(schema_1.vendorProducts)
                    .set({ productId: copy.id })
                    .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, listing.id));
                primary = copy;
            }
            const groupId = primary.variantGroupId ?? (0, crypto_1.randomUUID)();
            await tx
                .update(schema_1.products)
                .set({ variantGroupId: groupId, variantLabel: primary.unit })
                .where((0, drizzle_orm_1.eq)(schema_1.products.id, primary.id));
            const shared = {
                categoryId: primary.categoryId,
                brand: primary.brand,
                name: primary.name,
                description: primary.description,
                imageUrl: primary.imageUrl,
                variantGroupId: groupId,
            };
            const byListing = new Map(others.map((s) => [s.listing.id, s]));
            const kept = new Set();
            for (const size of wanted) {
                const existing = size.listingId
                    ? byListing.get(size.listingId)
                    : undefined;
                if (size.listingId && !existing) {
                    throw new common_1.BadRequestException(`Size "${size.label}" was changed elsewhere. Reload and try again.`);
                }
                if (existing) {
                    kept.add(existing.listing.id);
                    await tx
                        .update(schema_1.products)
                        .set({ ...shared, unit: size.label, variantLabel: size.label })
                        .where((0, drizzle_orm_1.eq)(schema_1.products.id, existing.product.id));
                    await tx
                        .update(schema_1.vendorProducts)
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
                        .where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, existing.listing.id));
                    continue;
                }
                const [created] = await tx
                    .insert(schema_1.products)
                    .values({
                    ...shared,
                    unit: size.label,
                    variantLabel: size.label,
                    status: 'active',
                    ownerVendorId: vendorId,
                })
                    .returning();
                await tx.insert(schema_1.vendorProducts).values({
                    vendorId,
                    productId: created.id,
                    price: size.price,
                    stockQty: size.stockQty !== undefined
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
    adminSizesFor(row, rows) {
        if (!row.variantGroupId)
            return [];
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
    withPublicSizes(items) {
        const byGroup = new Map();
        for (const item of items) {
            if (!item.variantGroupId)
                continue;
            const list = byGroup.get(item.variantGroupId) ?? [];
            list.push(item);
            byGroup.set(item.variantGroupId, list);
        }
        return items.map((item) => {
            const group = item.variantGroupId
                ? byGroup.get(item.variantGroupId)
                : undefined;
            const sizes = group && group.length > 1
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
    async siblingProductIds(product) {
        if (!product.variantGroupId)
            return [];
        const rows = await this.db
            .select({ id: schema_1.products.id })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.variantGroupId, product.variantGroupId), (0, drizzle_orm_1.ne)(schema_1.products.id, product.id), (0, drizzle_orm_1.eq)(schema_1.products.status, 'active')));
        return rows.map((r) => r.id);
    }
    async siblingsAt(tx, vendorId, primary, listingId) {
        if (!primary.variantGroupId)
            return [];
        const rows = await tx
            .select({ listing: schema_1.vendorProducts, product: schema_1.products })
            .from(schema_1.vendorProducts)
            .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorProducts.productId, schema_1.products.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.products.variantGroupId, primary.variantGroupId), (0, drizzle_orm_1.eq)(schema_1.products.ownerVendorId, vendorId)));
        return rows.filter((r) => r.listing.id !== listingId);
    }
    async removeSize(tx, listing, product) {
        await tx.delete(schema_1.vendorProducts).where((0, drizzle_orm_1.eq)(schema_1.vendorProducts.id, listing.id));
        await tx
            .update(schema_1.products)
            .set({ status: 'inactive', variantGroupId: null, variantLabel: null })
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, product.id));
    }
};
exports.GrocerySizesService = GrocerySizesService;
exports.GrocerySizesService = GrocerySizesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], GrocerySizesService);
//# sourceMappingURL=grocery-sizes.service.js.map