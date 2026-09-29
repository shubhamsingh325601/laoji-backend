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
var AreaManagerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AreaManagerService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const notification_service_1 = require("../notification/notification.service");
const handover_escalation_1 = require("../notification/templates/email/handover-escalation");
let AreaManagerService = AreaManagerService_1 = class AreaManagerService {
    db;
    notifications;
    logger = new common_1.Logger(AreaManagerService_1.name);
    constructor(db, notifications) {
        this.db = db;
        this.notifications = notifications;
    }
    async findAll(search) {
        let query = this.db.select().from(schema_1.areaManagers).orderBy((0, drizzle_orm_1.desc)(schema_1.areaManagers.createdAt));
        if (search && search.trim()) {
            const q = `%${search.trim().toLowerCase()}%`;
            return this.db
                .select()
                .from(schema_1.areaManagers)
                .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.areaManagers.name, q), (0, drizzle_orm_1.ilike)(schema_1.areaManagers.email, q), (0, drizzle_orm_1.ilike)(schema_1.areaManagers.phone, q), (0, drizzle_orm_1.ilike)(schema_1.areaManagers.pincode, q)))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.areaManagers.createdAt));
        }
        return query;
    }
    async findOne(id) {
        const [manager] = await this.db.select().from(schema_1.areaManagers).where((0, drizzle_orm_1.eq)(schema_1.areaManagers.id, id)).limit(1);
        if (!manager) {
            throw new common_1.NotFoundException(`Area manager not found`);
        }
        return manager;
    }
    async create(dto) {
        const email = dto.email.trim().toLowerCase();
        const [existing] = await this.db.select().from(schema_1.areaManagers).where((0, drizzle_orm_1.eq)(schema_1.areaManagers.email, email)).limit(1);
        if (existing) {
            throw new common_1.BadRequestException(`An Area Manager with email ${email} already exists`);
        }
        const [created] = await this.db
            .insert(schema_1.areaManagers)
            .values({
            name: dto.name.trim(),
            email,
            phone: dto.phone.trim(),
            pincode: dto.pincode ? dto.pincode.trim() : '325601',
            isActive: dto.isActive !== undefined ? dto.isActive : true,
        })
            .returning();
        return created;
    }
    async update(id, dto) {
        await this.findOne(id);
        const updateValues = {
            updatedAt: new Date(),
        };
        if (dto.name !== undefined)
            updateValues.name = dto.name.trim();
        if (dto.phone !== undefined)
            updateValues.phone = dto.phone.trim();
        if (dto.pincode !== undefined)
            updateValues.pincode = dto.pincode.trim();
        if (dto.isActive !== undefined)
            updateValues.isActive = dto.isActive;
        if (dto.email !== undefined) {
            const email = dto.email.trim().toLowerCase();
            const [duplicate] = await this.db
                .select()
                .from(schema_1.areaManagers)
                .where((0, drizzle_orm_1.eq)(schema_1.areaManagers.email, email))
                .limit(1);
            if (duplicate && duplicate.id !== id) {
                throw new common_1.BadRequestException(`An Area Manager with email ${email} already exists`);
            }
            updateValues.email = email;
        }
        const [updated] = await this.db
            .update(schema_1.areaManagers)
            .set(updateValues)
            .where((0, drizzle_orm_1.eq)(schema_1.areaManagers.id, id))
            .returning();
        return updated;
    }
    async delete(id) {
        await this.findOne(id);
        await this.db.delete(schema_1.areaManagers).where((0, drizzle_orm_1.eq)(schema_1.areaManagers.id, id));
        return { success: true, message: 'Area manager removed successfully' };
    }
    async findManagerForPincode(pincode) {
        const targetPin = pincode ? pincode.trim() : '325601';
        const [manager] = await this.db
            .select()
            .from(schema_1.areaManagers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.areaManagers.pincode, targetPin), (0, drizzle_orm_1.eq)(schema_1.areaManagers.isActive, true)))
            .limit(1);
        if (manager)
            return manager;
        if (targetPin !== '325601') {
            const [fallback] = await this.db
                .select()
                .from(schema_1.areaManagers)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.areaManagers.pincode, '325601'), (0, drizzle_orm_1.eq)(schema_1.areaManagers.isActive, true)))
                .limit(1);
            if (fallback)
                return fallback;
        }
        const [anyActive] = await this.db
            .select()
            .from(schema_1.areaManagers)
            .where((0, drizzle_orm_1.eq)(schema_1.areaManagers.isActive, true))
            .limit(1);
        return anyActive || null;
    }
    async dispatchHandoverEscalation(params) {
        const manager = await this.findManagerForPincode(params.pincode);
        if (!manager) {
            this.logger.warn(`No active Area Manager found to receive handover escalation for order ${params.orderCode}`);
            return { sent: false, reason: 'No active Area Manager found' };
        }
        const emailTemplate = (0, handover_escalation_1.handoverEscalationEmail)(params);
        this.logger.log(`Dispatching Handover Escalation for Order ${params.orderCode} to Area Manager ${manager.name} (${manager.email})`);
        const result = await this.notifications.sendDirectEmail(manager.email, emailTemplate);
        return {
            sent: result.ok,
            manager: {
                id: manager.id,
                name: manager.name,
                email: manager.email,
                phone: manager.phone,
                pincode: manager.pincode,
            },
        };
    }
};
exports.AreaManagerService = AreaManagerService;
exports.AreaManagerService = AreaManagerService = AreaManagerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, notification_service_1.NotificationService])
], AreaManagerService);
//# sourceMappingURL=area-manager.service.js.map