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
exports.RevenueConfigService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const DEFAULT_CONFIG = { commissionPct: 0.1, deliveryFeeFlat: 30, codThreshold: null };
let RevenueConfigService = class RevenueConfigService {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(adminUserId, dto) {
        const [row] = await this.db
            .insert(schema_1.revenueConfig)
            .values({
            scope: dto.scope,
            scopeRefId: dto.scope === 'global' ? null : dto.scopeRefId,
            commissionPct: dto.commissionPct,
            deliveryFeeFlat: dto.deliveryFeeFlat,
            codThreshold: dto.codThreshold ?? null,
            notes: dto.notes ?? null,
            effectiveFrom: new Date(dto.effectiveFrom),
            createdBy: adminUserId,
        })
            .returning();
        return row;
    }
    async listAll() {
        const rows = await this.db.select().from(schema_1.revenueConfig).orderBy((0, drizzle_orm_1.desc)(schema_1.revenueConfig.effectiveFrom));
        if (!rows.length)
            return [];
        const creatorIds = [...new Set(rows.map((r) => r.createdBy).filter((id) => !!id))];
        const creators = creatorIds.length ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, creatorIds)) : [];
        const emailById = new Map(creators.map((u) => [u.id, u.email ?? u.phone ?? '']));
        return rows.map((r) => ({ ...r, createdByLabel: r.createdBy ? (emailById.get(r.createdBy) ?? '') : '' }));
    }
    async resolve(vendorId, categoryId, asOf = new Date()) {
        const rows = await this.db.select().from(schema_1.revenueConfig).where((0, drizzle_orm_1.lte)(schema_1.revenueConfig.effectiveFrom, asOf));
        const latest = (candidates) => candidates.length ? candidates.reduce((a, b) => (a.effectiveFrom > b.effectiveFrom ? a : b)) : null;
        const vendorRule = latest(rows.filter((r) => r.scope === 'vendor' && r.scopeRefId === vendorId));
        if (vendorRule)
            return this.toResolved(vendorRule);
        if (categoryId) {
            const categoryRule = latest(rows.filter((r) => r.scope === 'category' && r.scopeRefId === categoryId));
            if (categoryRule)
                return this.toResolved(categoryRule);
        }
        const globalRule = latest(rows.filter((r) => r.scope === 'global'));
        if (globalRule)
            return this.toResolved(globalRule);
        return DEFAULT_CONFIG;
    }
    toResolved(row) {
        return { commissionPct: row.commissionPct, deliveryFeeFlat: row.deliveryFeeFlat, codThreshold: row.codThreshold };
    }
};
exports.RevenueConfigService = RevenueConfigService;
exports.RevenueConfigService = RevenueConfigService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], RevenueConfigService);
//# sourceMappingURL=revenue-config.service.js.map