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
exports.HomeTabService = exports.HOME_TABS_SETTING = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const response_cache_service_1 = require("../../common/cache/response-cache.service");
const home_tab_dto_1 = require("./dto/home-tab.dto");
exports.HOME_TABS_SETTING = 'home_tabs';
const DEFAULT_TABS = [
    { key: 'grocery', label: 'Grocery', isActive: true },
    { key: 'non_veg', label: 'Non-Veg', isActive: true },
    { key: 'veg', label: 'Veg', isActive: true },
];
let HomeTabService = class HomeTabService {
    db;
    cache;
    constructor(db, cache) {
        this.db = db;
        this.cache = cache;
    }
    async listAll() {
        const [row] = await this.db
            .select({ value: schema_1.platformSettings.value })
            .from(schema_1.platformSettings)
            .where((0, drizzle_orm_1.eq)(schema_1.platformSettings.key, exports.HOME_TABS_SETTING))
            .limit(1);
        if (!row)
            return DEFAULT_TABS;
        try {
            const saved = JSON.parse(row.value);
            const valid = saved.filter((t) => home_tab_dto_1.HOME_TAB_KEYS.includes(t.key));
            const missing = DEFAULT_TABS.filter((d) => !valid.some((t) => t.key === d.key));
            return [...valid, ...missing];
        }
        catch {
            return DEFAULT_TABS;
        }
    }
    async listLive() {
        return (await this.listAll()).filter((t) => t.isActive).map(({ key, label }) => ({ key, label }));
    }
    async update(tabs, adminId) {
        const keys = new Set(tabs.map((t) => t.key));
        if (keys.size !== home_tab_dto_1.HOME_TAB_KEYS.length) {
            throw new common_1.BadRequestException('Each of grocery, veg and non_veg must appear exactly once');
        }
        const value = JSON.stringify(tabs.map((t) => ({ key: t.key, label: t.label.trim(), isActive: t.isActive })));
        await this.db
            .insert(schema_1.platformSettings)
            .values({
            key: exports.HOME_TABS_SETTING,
            value,
            description: 'Customer home screen tabs: order, labels and visibility',
            updatedBy: adminId,
        })
            .onConflictDoUpdate({
            target: schema_1.platformSettings.key,
            set: { value, updatedAt: new Date(), updatedBy: adminId },
        });
        this.cache?.clear();
        return this.listAll();
    }
};
exports.HomeTabService = HomeTabService;
exports.HomeTabService = HomeTabService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __param(1, (0, common_1.Inject)(response_cache_service_1.ResponseCacheService)),
    __metadata("design:paramtypes", [Object, response_cache_service_1.ResponseCacheService])
], HomeTabService);
//# sourceMappingURL=home-tab.service.js.map