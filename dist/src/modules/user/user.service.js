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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const notification_service_1 = require("../notification/notification.service");
let UserService = class UserService {
    db;
    notifications;
    constructor(db, notifications) {
        this.db = db;
        this.notifications = notifications;
    }
    async listUsers(role, search) {
        let query = this.db.select().from(schema_1.users);
        const rows = await query.orderBy((0, drizzle_orm_1.desc)(schema_1.users.createdAt));
        let filtered = rows;
        if (role && role !== 'all') {
            filtered = filtered.filter((u) => u.role === role);
        }
        if (search && search.trim()) {
            const q = search.toLowerCase();
            filtered = filtered.filter((u) => (u.phone && u.phone.includes(q)) || (u.email && u.email.toLowerCase().includes(q)));
        }
        const userIds = filtered.map((u) => u.id);
        const userAddresses = userIds.length
            ? await this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.inArray)(schema_1.addresses.userId, userIds))
            : [];
        const addrMap = new Map();
        for (const a of userAddresses) {
            if (!addrMap.has(a.userId) || a.isDefault) {
                addrMap.set(a.userId, a);
            }
        }
        return filtered.map((u) => {
            const addr = addrMap.get(u.id);
            return {
                id: u.id,
                phone: u.phone,
                email: u.email,
                role: u.role,
                status: u.status,
                name: u.role === 'customer' ? `Customer +91 ${u.phone}` : `${u.role.toUpperCase()} User`,
                address: addr?.formattedAddress ?? 'Rural Area / Locality',
                createdAt: u.createdAt,
            };
        });
    }
    async getUser(id) {
        const [u] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id)).limit(1);
        if (!u)
            throw new common_1.NotFoundException('User not found');
        const userAddresses = await this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.eq)(schema_1.addresses.userId, id));
        const groceryList = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.customerId, id)).limit(10);
        const foodList = await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.customerId, id)).limit(10);
        return {
            id: u.id,
            phone: u.phone,
            email: u.email,
            role: u.role,
            status: u.status,
            name: `Customer +91 ${u.phone}`,
            addresses: userAddresses,
            orderCount: groceryList.length + foodList.length,
            recentOrders: [...groceryList, ...foodList].slice(0, 10),
            createdAt: u.createdAt,
        };
    }
    async createUser(dto) {
        const role = dto.role ?? 'customer';
        const status = dto.status ?? 'active';
        const [existing] = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.phone, dto.phone), (0, drizzle_orm_1.eq)(schema_1.users.role, role)))
            .limit(1);
        if (existing) {
            throw new common_1.BadRequestException(`An account with phone ${dto.phone} and role ${role} already exists.`);
        }
        const [created] = await this.db
            .insert(schema_1.users)
            .values({
            phone: dto.phone,
            email: dto.email || null,
            role,
            status,
        })
            .returning();
        if (dto.address) {
            await this.db.insert(schema_1.addresses).values({
                userId: created.id,
                label: 'Home',
                lat: 16.705,
                lng: 74.2433,
                formattedAddress: dto.address + (dto.city ? `, ${dto.city}` : ''),
                isDefault: true,
            });
        }
        if (dto.email) {
            this.notifications.sendWelcomeCustomerEmail({
                id: created.id,
                name: dto.name || `User +91 ${dto.phone}`,
                email: dto.email,
                phone: dto.phone,
            });
        }
        return created;
    }
    async updateUser(id, dto) {
        const [u] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id)).limit(1);
        if (!u)
            throw new common_1.NotFoundException('User not found');
        const [updated] = await this.db
            .update(schema_1.users)
            .set({
            phone: dto.phone !== undefined ? dto.phone : u.phone,
            email: dto.email !== undefined ? dto.email : u.email,
            role: dto.role !== undefined ? dto.role : u.role,
            status: dto.status !== undefined ? dto.status : u.status,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))
            .returning();
        return updated;
    }
    async deleteUser(id) {
        const [u] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id)).limit(1);
        if (!u)
            throw new common_1.NotFoundException('User not found');
        await this.db.delete(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return { success: true, message: `User ${id} deleted successfully.` };
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, notification_service_1.NotificationService])
], UserService);
//# sourceMappingURL=user.service.js.map