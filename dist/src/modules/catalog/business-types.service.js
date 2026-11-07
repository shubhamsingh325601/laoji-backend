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
exports.BusinessTypesService = exports.DEFAULT_PLATFORM_HOME_TABS = exports.DEFAULT_PLATFORM_BUSINESS_TYPES = exports.HOME_TABS_SETTING = exports.BUSINESS_TYPES_SETTING = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
exports.BUSINESS_TYPES_SETTING = 'platform_business_types';
exports.HOME_TABS_SETTING = 'platform_home_tabs';
exports.DEFAULT_PLATFORM_BUSINESS_TYPES = [
    { id: 'grocery', label: 'Grocery & Essentials', labelHindi: 'किराना और राशन', icon: 'shopping-basket', isActive: true, allowVendorSignup: true, displayOrder: 1 },
    { id: 'restaurant', label: 'Restaurant & Eatery', labelHindi: 'रेस्टोरेंट और खाना', icon: 'restaurant', isActive: true, allowVendorSignup: true, displayOrder: 2 },
    { id: 'vegetables_fruits', label: 'Fruits & Vegetables', labelHindi: 'फल और सब्जियां', icon: 'eco', isActive: true, allowVendorSignup: true, displayOrder: 3 },
    { id: 'medical', label: 'Pharmacy & Medical', labelHindi: 'दवाई और मेडिकल', icon: 'local-pharmacy', isActive: true, allowVendorSignup: true, displayOrder: 4 },
    { id: 'dairy', label: 'Dairy & Milk', labelHindi: 'दूध और डेयरी', icon: 'local-drink', isActive: true, allowVendorSignup: true, displayOrder: 5 },
    { id: 'bakery_sweets', label: 'Bakery & Sweets', labelHindi: 'मिठाई और बेकरी', icon: 'cake', isActive: true, allowVendorSignup: true, displayOrder: 6 },
    { id: 'clothing', label: 'Clothing & Fashion', labelHindi: 'कपड़े और परिधान', icon: 'checkroom', isActive: true, allowVendorSignup: true, displayOrder: 7 },
    { id: 'electronics', label: 'Electronics & Repairs', labelHindi: 'इलेक्ट्रॉनिक्स और मोबाइल', icon: 'devices', isActive: true, allowVendorSignup: true, displayOrder: 8 },
    { id: 'stationery', label: 'Stationery & Books', labelHindi: 'स्टेशनरी और किताबें', icon: 'menu-book', isActive: true, allowVendorSignup: true, displayOrder: 9 },
    { id: 'general', label: 'General Store', labelHindi: 'जनरल स्टोर', icon: 'storefront', isActive: true, allowVendorSignup: true, displayOrder: 10 },
];
exports.DEFAULT_PLATFORM_HOME_TABS = [
    { key: 'grocery', label: 'Grocery', isActive: true },
    { key: 'veg', label: 'Veg', isActive: true },
    { key: 'non_veg', label: 'Non-Veg', isActive: true },
];
let BusinessTypesService = class BusinessTypesService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getBusinessTypes() {
        try {
            const [row] = await this.db
                .select({ value: schema_1.platformSettings.value })
                .from(schema_1.platformSettings)
                .where((0, drizzle_orm_1.eq)(schema_1.platformSettings.key, exports.BUSINESS_TYPES_SETTING))
                .limit(1);
            if (row?.value) {
                const parsed = JSON.parse(row.value);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        }
        catch {
        }
        return exports.DEFAULT_PLATFORM_BUSINESS_TYPES;
    }
    async getPublicBusinessTypes() {
        const all = await this.getBusinessTypes();
        return all.filter((b) => b.isActive);
    }
    async updateBusinessTypes(types, adminId) {
        const value = JSON.stringify(types);
        await this.db
            .insert(schema_1.platformSettings)
            .values({
            key: exports.BUSINESS_TYPES_SETTING,
            value,
            description: 'Admin-configured supported business types and modules',
            updatedAt: new Date(),
            updatedBy: adminId || null,
        })
            .onConflictDoUpdate({
            target: schema_1.platformSettings.key,
            set: {
                value,
                updatedAt: new Date(),
                updatedBy: adminId || null,
            },
        });
        return types;
    }
    async getHomeTabs() {
        try {
            const [row] = await this.db
                .select({ value: schema_1.platformSettings.value })
                .from(schema_1.platformSettings)
                .where((0, drizzle_orm_1.eq)(schema_1.platformSettings.key, exports.HOME_TABS_SETTING))
                .limit(1);
            if (row?.value) {
                const parsed = JSON.parse(row.value);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        }
        catch {
        }
        return exports.DEFAULT_PLATFORM_HOME_TABS;
    }
    async updateHomeTabs(tabs, adminId) {
        const value = JSON.stringify(tabs);
        await this.db
            .insert(schema_1.platformSettings)
            .values({
            key: exports.HOME_TABS_SETTING,
            value,
            description: 'Customer app home tabs configuration',
            updatedAt: new Date(),
            updatedBy: adminId || null,
        })
            .onConflictDoUpdate({
            target: schema_1.platformSettings.key,
            set: {
                value,
                updatedAt: new Date(),
                updatedBy: adminId || null,
            },
        });
        return tabs;
    }
};
exports.BusinessTypesService = BusinessTypesService;
exports.BusinessTypesService = BusinessTypesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], BusinessTypesService);
//# sourceMappingURL=business-types.service.js.map