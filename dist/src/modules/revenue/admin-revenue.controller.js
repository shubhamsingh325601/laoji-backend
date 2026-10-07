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
exports.AdminRevenueController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const revenue_config_service_1 = require("./revenue-config.service");
const settlement_service_1 = require("./settlement.service");
const rider_payout_service_1 = require("./rider-payout.service");
const create_revenue_config_dto_1 = require("./dto/create-revenue-config.dto");
class SetRiderPayoutTiersDto {
    tiers;
}
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SetRiderPayoutTiersDto.prototype, "tiers", void 0);
let AdminRevenueController = class AdminRevenueController {
    revenueConfig;
    settlements;
    riderPayout;
    constructor(revenueConfig, settlements, riderPayout) {
        this.revenueConfig = revenueConfig;
        this.settlements = settlements;
        this.riderPayout = riderPayout;
    }
    create(user, dto) {
        return this.revenueConfig.create(user.sub, dto);
    }
    listAll() {
        return this.revenueConfig.listAll();
    }
    async listRiderPayoutTiers() {
        return { tiers: await this.riderPayout.listTiers() };
    }
    async setRiderPayoutTiers(dto) {
        return { tiers: await this.riderPayout.replaceTiers(dto.tiers) };
    }
    listSettlements() {
        return this.settlements.listAllForAdmin();
    }
};
exports.AdminRevenueController = AdminRevenueController;
__decorate([
    (0, common_1.Post)('revenue-config'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_revenue_config_dto_1.CreateRevenueConfigDto]),
    __metadata("design:returntype", void 0)
], AdminRevenueController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('revenue-config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminRevenueController.prototype, "listAll", null);
__decorate([
    (0, common_1.Get)('rider-payout-tiers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminRevenueController.prototype, "listRiderPayoutTiers", null);
__decorate([
    (0, common_1.Put)('rider-payout-tiers'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SetRiderPayoutTiersDto]),
    __metadata("design:returntype", Promise)
], AdminRevenueController.prototype, "setRiderPayoutTiers", null);
__decorate([
    (0, common_1.Get)('settlements'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminRevenueController.prototype, "listSettlements", null);
exports.AdminRevenueController = AdminRevenueController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin'),
    __metadata("design:paramtypes", [revenue_config_service_1.RevenueConfigService,
        settlement_service_1.SettlementService,
        rider_payout_service_1.RiderPayoutService])
], AdminRevenueController);
//# sourceMappingURL=admin-revenue.controller.js.map