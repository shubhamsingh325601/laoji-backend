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
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const revenue_config_service_1 = require("./revenue-config.service");
const settlement_service_1 = require("./settlement.service");
const create_revenue_config_dto_1 = require("./dto/create-revenue-config.dto");
let AdminRevenueController = class AdminRevenueController {
    revenueConfig;
    settlements;
    constructor(revenueConfig, settlements) {
        this.revenueConfig = revenueConfig;
        this.settlements = settlements;
    }
    create(user, dto) {
        return this.revenueConfig.create(user.sub, dto);
    }
    listAll() {
        return this.revenueConfig.listAll();
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
        settlement_service_1.SettlementService])
], AdminRevenueController);
//# sourceMappingURL=admin-revenue.controller.js.map