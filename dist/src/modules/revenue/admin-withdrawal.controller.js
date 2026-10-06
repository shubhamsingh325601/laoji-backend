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
exports.AdminWithdrawalController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const vendor_withdrawal_service_1 = require("./vendor-withdrawal.service");
const vendor_withdrawal_dto_1 = require("./dto/vendor-withdrawal.dto");
let AdminWithdrawalController = class AdminWithdrawalController {
    withdrawals;
    constructor(withdrawals) {
        this.withdrawals = withdrawals;
    }
    list(status) {
        return this.withdrawals.listForAdmin(status === 'pending' || status === 'approved' || status === 'rejected' ? status : undefined);
    }
    get(id) {
        return this.withdrawals.getForAdmin(id);
    }
    approve(user, id, dto) {
        return this.withdrawals.approve(id, user.sub, dto.payoutReference);
    }
    reject(user, id, dto) {
        return this.withdrawals.reject(id, user.sub, dto.reason);
    }
};
exports.AdminWithdrawalController = AdminWithdrawalController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminWithdrawalController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminWithdrawalController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, vendor_withdrawal_dto_1.ApproveWithdrawalDto]),
    __metadata("design:returntype", void 0)
], AdminWithdrawalController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, vendor_withdrawal_dto_1.RejectWithdrawalDto]),
    __metadata("design:returntype", void 0)
], AdminWithdrawalController.prototype, "reject", null);
exports.AdminWithdrawalController = AdminWithdrawalController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin/vendor-withdrawals'),
    __metadata("design:paramtypes", [vendor_withdrawal_service_1.VendorWithdrawalService])
], AdminWithdrawalController);
//# sourceMappingURL=admin-withdrawal.controller.js.map