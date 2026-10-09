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
var VendorScheduleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorScheduleService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const catalog_types_1 = require("./catalog.types");
const TICK_MS = 20_000;
let VendorScheduleService = VendorScheduleService_1 = class VendorScheduleService {
    db;
    logger = new common_1.Logger(VendorScheduleService_1.name);
    timer;
    running = false;
    constructor(db) {
        this.db = db;
    }
    async onModuleInit() {
        try {
            await this.db.execute((0, drizzle_orm_1.sql) `ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "schedule_state" boolean`);
        }
        catch (err) {
            this.logger.warn(`schedule_state auto-migration skipped: ${err instanceof Error ? err.message : err}`);
        }
        await this.tick();
        this.timer = setInterval(() => void this.tick(), TICK_MS);
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async tick(now = new Date()) {
        if (this.running)
            return;
        this.running = true;
        try {
            const rows = await this.db
                .select({
                id: schema_1.vendors.id,
                businessHours: schema_1.vendors.businessHours,
                scheduleState: schema_1.vendors.scheduleState,
                isOpen: schema_1.vendors.isOpen,
            })
                .from(schema_1.vendors)
                .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.vendors.userId))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.isNotNull)(schema_1.vendors.businessHours), (0, drizzle_orm_1.eq)(schema_1.users.status, 'active')));
            for (const v of rows) {
                if (!v.businessHours || v.businessHours.length === 0)
                    continue;
                const scheduledOpen = (0, catalog_types_1.isWithinSchedule)(v.businessHours, now);
                if (v.scheduleState === scheduledOpen)
                    continue;
                await this.db
                    .update(schema_1.vendors)
                    .set({ isOpen: scheduledOpen, scheduleState: scheduledOpen })
                    .where((0, drizzle_orm_1.eq)(schema_1.vendors.id, v.id));
                await this.db.update(schema_1.restaurants).set({ isOpen: scheduledOpen }).where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, v.id));
                this.logger.log(`Vendor ${v.id} ${scheduledOpen ? 'opened' : 'closed'} by schedule`);
            }
        }
        catch (err) {
            this.logger.error(`Schedule tick failed: ${err instanceof Error ? err.message : err}`);
        }
        finally {
            this.running = false;
        }
    }
};
exports.VendorScheduleService = VendorScheduleService;
exports.VendorScheduleService = VendorScheduleService = VendorScheduleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], VendorScheduleService);
//# sourceMappingURL=vendor-schedule.service.js.map