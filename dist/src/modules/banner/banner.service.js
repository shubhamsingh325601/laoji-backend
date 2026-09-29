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
exports.BannerService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
let BannerService = class BannerService {
    db;
    constructor(db) {
        this.db = db;
    }
    listAllForAdmin() {
        return this.db.select().from(schema_1.banners).orderBy((0, drizzle_orm_1.asc)(schema_1.banners.placement), (0, drizzle_orm_1.asc)(schema_1.banners.sortOrder), (0, drizzle_orm_1.desc)(schema_1.banners.createdAt));
    }
    listLive(placement) {
        const now = new Date();
        return this.db
            .select({
            id: schema_1.banners.id,
            title: schema_1.banners.title,
            subtitle: schema_1.banners.subtitle,
            imageUrl: schema_1.banners.imageUrl,
            link: schema_1.banners.link,
        })
            .from(schema_1.banners)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.banners.isActive, true), (0, drizzle_orm_1.eq)(schema_1.banners.placement, placement), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.banners.startsAt), (0, drizzle_orm_1.lte)(schema_1.banners.startsAt, now)), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.banners.endsAt), (0, drizzle_orm_1.gte)(schema_1.banners.endsAt, now))))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.banners.sortOrder), (0, drizzle_orm_1.desc)(schema_1.banners.createdAt));
    }
    async create(dto) {
        const [row] = await this.db
            .insert(schema_1.banners)
            .values({
            title: dto.title.trim(),
            subtitle: dto.subtitle?.trim() || null,
            imageUrl: dto.imageUrl,
            link: dto.link?.trim() || null,
            placement: dto.placement ?? 'home',
            sortOrder: dto.sortOrder ?? 0,
            isActive: dto.isActive ?? true,
            startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
            endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        })
            .returning();
        return row;
    }
    async update(id, dto) {
        await this.findOrThrow(id);
        const updates = {};
        if (dto.title !== undefined)
            updates.title = dto.title.trim();
        if (dto.subtitle !== undefined)
            updates.subtitle = dto.subtitle?.trim() || null;
        if (dto.imageUrl !== undefined)
            updates.imageUrl = dto.imageUrl;
        if (dto.link !== undefined)
            updates.link = dto.link?.trim() || null;
        if (dto.placement !== undefined)
            updates.placement = dto.placement;
        if (dto.sortOrder !== undefined)
            updates.sortOrder = dto.sortOrder;
        if (dto.isActive !== undefined)
            updates.isActive = dto.isActive;
        if (dto.startsAt !== undefined)
            updates.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
        if (dto.endsAt !== undefined)
            updates.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
        const [row] = await this.db.update(schema_1.banners).set(updates).where((0, drizzle_orm_1.eq)(schema_1.banners.id, id)).returning();
        return row;
    }
    async delete(id) {
        await this.findOrThrow(id);
        await this.db.delete(schema_1.banners).where((0, drizzle_orm_1.eq)(schema_1.banners.id, id));
        return { success: true };
    }
    async findOrThrow(id) {
        const [row] = await this.db.select().from(schema_1.banners).where((0, drizzle_orm_1.eq)(schema_1.banners.id, id)).limit(1);
        if (!row)
            throw new common_1.NotFoundException('Banner not found');
        return row;
    }
};
exports.BannerService = BannerService;
exports.BannerService = BannerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], BannerService);
//# sourceMappingURL=banner.service.js.map