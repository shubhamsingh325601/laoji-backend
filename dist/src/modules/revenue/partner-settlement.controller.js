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
exports.PartnerSettlementController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const settlement_service_1 = require("./settlement.service");
let PartnerSettlementController = class PartnerSettlementController {
    settlements;
    constructor(settlements) {
        this.settlements = settlements;
    }
    async list(user) {
        const partnerId = await this.settlements.partnerIdForUser(user.sub);
        return this.settlements.listForPartner(partnerId);
    }
    async withdraw(user) {
        return this.settlements.requestPartnerWithdrawal(user.sub);
    }
};
exports.PartnerSettlementController = PartnerSettlementController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PartnerSettlementController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('withdraw'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PartnerSettlementController.prototype, "withdraw", null);
exports.PartnerSettlementController = PartnerSettlementController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('delivery_partner'),
    (0, common_1.Controller)('delivery/settlements'),
    __metadata("design:paramtypes", [settlement_service_1.SettlementService])
], PartnerSettlementController);
//# sourceMappingURL=partner-settlement.controller.js.map