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
            filtered = filtered.filter((u) => (u.phone && u.phone.includes(q)) ||
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.name && u.name.toLowerCase().includes(q)));
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
        const userWallets = userIds.length
            ? await this.db.select().from(schema_1.wallets).where((0, drizzle_orm_1.inArray)(schema_1.wallets.userId, userIds))
            : [];
        const walletMap = new Map(userWallets.map((w) => [w.userId, w]));
        const customerIds = filtered.filter((u) => u.role === 'customer').map((u) => u.id);
        const groceryStats = customerIds.length
            ? await this.db
                .select({ customerId: schema_1.groceryOrders.customerId, count: (0, drizzle_orm_1.count)(schema_1.groceryOrders.id), total: (0, drizzle_orm_1.sum)(schema_1.groceryOrders.total) })
                .from(schema_1.groceryOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.groceryOrders.customerId, customerIds), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'delivered')))
                .groupBy(schema_1.groceryOrders.customerId)
            : [];
        const foodStats = customerIds.length
            ? await this.db
                .select({ customerId: schema_1.foodOrders.customerId, count: (0, drizzle_orm_1.count)(schema_1.foodOrders.id), total: (0, drizzle_orm_1.sum)(schema_1.foodOrders.total) })
                .from(schema_1.foodOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.foodOrders.customerId, customerIds), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'delivered')))
                .groupBy(schema_1.foodOrders.customerId)
            : [];
        const groceryStatsById = new Map(groceryStats.map((s) => [s.customerId, s]));
        const foodStatsById = new Map(foodStats.map((s) => [s.customerId, s]));
        return filtered.map((u) => {
            const addr = addrMap.get(u.id);
            const g = groceryStatsById.get(u.id);
            const f = foodStatsById.get(u.id);
            const w = walletMap.get(u.id);
            return {
                id: u.id,
                phone: u.phone,
                email: u.email,
                role: u.role,
                status: u.status,
                name: u.name || (u.role === 'customer' ? `Customer +91 ${u.phone}` : `${u.role.toUpperCase()} User`),
                supportNotes: u.supportNotes ?? '',
                address: addr?.formattedAddress ?? 'Rural Area / Locality',
                createdAt: u.createdAt,
                totalOrders: Number(g?.count ?? 0) + Number(f?.count ?? 0),
                totalSpend: (Number(g?.total) || 0) + (Number(f?.total) || 0),
                walletBalance: Math.round(Number(w?.balance ?? 0) * 100) / 100,
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
        const [walletRow] = await this.db.select().from(schema_1.wallets).where((0, drizzle_orm_1.eq)(schema_1.wallets.userId, id)).limit(1);
        const [[groceryAgg], [foodAgg]] = await Promise.all([
            this.db
                .select({ count: (0, drizzle_orm_1.count)(schema_1.groceryOrders.id), total: (0, drizzle_orm_1.sum)(schema_1.groceryOrders.total) })
                .from(schema_1.groceryOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.customerId, id), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'delivered'))),
            this.db
                .select({ count: (0, drizzle_orm_1.count)(schema_1.foodOrders.id), total: (0, drizzle_orm_1.sum)(schema_1.foodOrders.total) })
                .from(schema_1.foodOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.customerId, id), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'delivered'))),
        ]);
        return {
            id: u.id,
            phone: u.phone,
            email: u.email,
            role: u.role,
            status: u.status,
            name: u.name || `Customer +91 ${u.phone}`,
            supportNotes: u.supportNotes ?? '',
            addresses: userAddresses,
            orderCount: Number(groceryAgg?.count ?? 0) + Number(foodAgg?.count ?? 0),
            totalSpend: (Number(groceryAgg?.total) || 0) + (Number(foodAgg?.total) || 0),
            walletBalance: walletRow ? Math.round(Number(walletRow.balance) * 100) / 100 : 0,
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
            name: dto.name || null,
            role,
            status,
        })
            .returning();
        if (dto.address) {
            await this.db.insert(schema_1.addresses).values({
                userId: created.id,
                label: 'Home',
                lat: 24.924,
                lng: 76.283,
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
        const targetRole = dto.role !== undefined ? dto.role : u.role;
        const targetPhone = dto.phone !== undefined ? dto.phone.trim() : u.phone;
        const targetEmail = dto.email !== undefined ? (dto.email ? dto.email.trim() : null) : u.email;
        if (targetPhone && (targetPhone !== u.phone || targetRole !== u.role)) {
            const [existingPhone] = await this.db
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.phone, targetPhone), (0, drizzle_orm_1.eq)(schema_1.users.role, targetRole), (0, drizzle_orm_1.ne)(schema_1.users.id, id)))
                .limit(1);
            if (existingPhone) {
                throw new common_1.BadRequestException(`An account with phone ${targetPhone} and role ${targetRole} already exists.`);
            }
        }
        if (targetEmail && targetEmail !== u.email) {
            const [existingEmail] = await this.db
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.email, targetEmail), (0, drizzle_orm_1.ne)(schema_1.users.id, id)))
                .limit(1);
            if (existingEmail) {
                throw new common_1.BadRequestException(`The email ${targetEmail} is already in use by another account.`);
            }
        }
        const updateData = {
            phone: targetPhone,
            email: targetEmail,
            role: targetRole,
            status: dto.status !== undefined ? dto.status : u.status,
        };
        if (dto.name !== undefined) {
            updateData.name = dto.name.trim() || null;
        }
        if (dto.supportNotes !== undefined) {
            updateData.supportNotes = dto.supportNotes.trim() || null;
        }
        const [updated] = await this.db
            .update(schema_1.users)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))
            .returning();
        return updated;
    }
    async deleteUser(id) {
        const [u] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id)).limit(1);
        if (!u)
            throw new common_1.NotFoundException('User not found');
        await this.db.delete(schema_1.kycDocuments).where((0, drizzle_orm_1.eq)(schema_1.kycDocuments.userId, id));
        await this.db
            .update(schema_1.authTokens)
            .set({ revokedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.authTokens.userId, id));
        try {
            await this.db.delete(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        }
        catch {
            await this.db
                .update(schema_1.users)
                .set({ status: 'suspended', phone: null, email: null, name: null })
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        }
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