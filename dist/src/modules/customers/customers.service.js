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
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const drizzle_orm_1 = require("drizzle-orm");
let CustomersService = class CustomersService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getCustomersWithStats() {
        const userRows = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.role, 'customer'));
        if (userRows.length === 0)
            return [];
        const userIds = userRows.map((u) => u.id);
        const groceryStats = await this.db
            .select({
            customerId: schema_1.groceryOrders.customerId,
            totalGroceryOrders: (0, drizzle_orm_1.count)(schema_1.groceryOrders.id),
            totalGrocerySpend: (0, drizzle_orm_1.sum)(schema_1.groceryOrders.total),
        })
            .from(schema_1.groceryOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.groceryOrders.customerId, userIds), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'delivered')))
            .groupBy(schema_1.groceryOrders.customerId);
        const foodStats = await this.db
            .select({
            customerId: schema_1.foodOrders.customerId,
            totalFoodOrders: (0, drizzle_orm_1.count)(schema_1.foodOrders.id),
            totalFoodSpend: (0, drizzle_orm_1.sum)(schema_1.foodOrders.total),
        })
            .from(schema_1.foodOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.foodOrders.customerId, userIds), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'delivered')))
            .groupBy(schema_1.foodOrders.customerId);
        const groceryMap = new Map();
        groceryStats.forEach((row) => {
            groceryMap.set(row.customerId, {
                totalGroceryOrders: Number(row.totalGroceryOrders),
                totalGrocerySpend: Number(row.totalGrocerySpend) || 0,
            });
        });
        const foodMap = new Map();
        foodStats.forEach((row) => {
            foodMap.set(row.customerId, {
                totalFoodOrders: Number(row.totalFoodOrders),
                totalFoodSpend: Number(row.totalFoodSpend) || 0,
            });
        });
        const customersWithStats = userRows.map((user) => {
            const g = groceryMap.get(user.id) || { totalGroceryOrders: 0, totalGrocerySpend: 0 };
            const f = foodMap.get(user.id) || { totalFoodOrders: 0, totalFoodSpend: 0 };
            const totalOrders = g.totalGroceryOrders + f.totalFoodOrders;
            const totalSpend = g.totalGrocerySpend + f.totalFoodSpend;
            return {
                id: user.id,
                name: user.name || `Customer +91 ${user.phone}`,
                phone: user.phone,
                joinedAt: user.createdAt,
                totalOrders,
                totalSpend,
                locality: user.city || '',
                supportNotes: user.supportNotes ?? '',
            };
        });
        return customersWithStats;
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], CustomersService);
//# sourceMappingURL=customers.service.js.map