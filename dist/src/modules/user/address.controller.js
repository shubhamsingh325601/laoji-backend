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
exports.AddressController = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const address_dto_1 = require("./dto/address.dto");
let AddressController = class AddressController {
    db;
    constructor(db) {
        this.db = db;
    }
    list(user) {
        return this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.eq)(schema_1.addresses.userId, user.sub));
    }
    async create(user, dto) {
        if (dto.isDefault) {
            await this.db.update(schema_1.addresses).set({ isDefault: false }).where((0, drizzle_orm_1.eq)(schema_1.addresses.userId, user.sub));
        }
        const [row] = await this.db
            .insert(schema_1.addresses)
            .values({
            userId: user.sub,
            label: dto.label,
            lat: dto.lat,
            lng: dto.lng,
            formattedAddress: dto.formattedAddress,
            isDefault: dto.isDefault ?? false,
        })
            .returning();
        return row;
    }
    async update(user, id, dto) {
        await this.requireOwn(user.sub, id);
        if (dto.isDefault) {
            await this.db.update(schema_1.addresses).set({ isDefault: false }).where((0, drizzle_orm_1.eq)(schema_1.addresses.userId, user.sub));
        }
        const [row] = await this.db.update(schema_1.addresses).set(dto).where((0, drizzle_orm_1.eq)(schema_1.addresses.id, id)).returning();
        return row;
    }
    async remove(user, id) {
        await this.requireOwn(user.sub, id);
        await this.db.delete(schema_1.addresses).where((0, drizzle_orm_1.eq)(schema_1.addresses.id, id));
        return { ok: true };
    }
    async requireOwn(userId, id) {
        const [row] = await this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.addresses.id, id), (0, drizzle_orm_1.eq)(schema_1.addresses.userId, userId))).limit(1);
        if (!row)
            throw new common_2.NotFoundException('Address not found');
        return row;
    }
};
exports.AddressController = AddressController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AddressController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, address_dto_1.CreateAddressDto]),
    __metadata("design:returntype", Promise)
], AddressController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, address_dto_1.UpdateAddressDto]),
    __metadata("design:returntype", Promise)
], AddressController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AddressController.prototype, "remove", null);
exports.AddressController = AddressController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('addresses'),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], AddressController);
//# sourceMappingURL=address.controller.js.map