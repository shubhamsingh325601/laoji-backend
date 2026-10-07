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
exports.AdminWalletController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const wallet_service_1 = require("./wallet.service");
const request_withdrawal_dto_1 = require("./dto/request-withdrawal.dto");
const adjust_wallet_dto_1 = require("./dto/adjust-wallet.dto");
let AdminWalletController = class AdminWalletController {
    wallet;
    constructor(wallet) {
        this.wallet = wallet;
    }
    async listWallets(role, search) {
        return this.wallet.listWallets({ role, search });
    }
    async listTransactions(limit) {
        return this.wallet.listAllTransactions(limit ? parseInt(limit, 10) : 100);
    }
    async getUserWallet(userId) {
        return this.wallet.getUserWalletSummary(userId);
    }
    async getVendorWallet(vendorId) {
        return this.wallet.getVendorWalletSummary(vendorId);
    }
    async adjustWallet(dto, admin) {
        return this.wallet.adjustWallet(dto, admin?.sub);
    }
    async listRequests(status) {
        return this.wallet.listAllWithdrawalRequests(status);
    }
    async approveRequest(id, dto) {
        return this.wallet.approveWithdrawal(id, dto?.adminNotes);
    }
    async rejectRequest(id, dto) {
        return this.wallet.rejectWithdrawal(id, dto?.adminNotes);
    }
};
exports.AdminWalletController = AdminWalletController;
__decorate([
    (0, common_1.Get)('wallets'),
    __param(0, (0, common_1.Query)('role')),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminWalletController.prototype, "listWallets", null);
__decorate([
    (0, common_1.Get)('transactions'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminWalletController.prototype, "listTransactions", null);
__decorate([
    (0, common_1.Get)('user/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminWalletController.prototype, "getUserWallet", null);
__decorate([
    (0, common_1.Get)('vendor/:vendorId'),
    __param(0, (0, common_1.Param)('vendorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminWalletController.prototype, "getVendorWallet", null);
__decorate([
    (0, common_1.Post)('adjust'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [adjust_wallet_dto_1.AdjustWalletDto, Object]),
    __metadata("design:returntype", Promise)
], AdminWalletController.prototype, "adjustWallet", null);
__decorate([
    (0, common_1.Get)('requests'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminWalletController.prototype, "listRequests", null);
__decorate([
    (0, common_1.Post)('requests/:id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, request_withdrawal_dto_1.ProcessWithdrawalDto]),
    __metadata("design:returntype", Promise)
], AdminWalletController.prototype, "approveRequest", null);
__decorate([
    (0, common_1.Post)('requests/:id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, request_withdrawal_dto_1.ProcessWithdrawalDto]),
    __metadata("design:returntype", Promise)
], AdminWalletController.prototype, "rejectRequest", null);
exports.AdminWalletController = AdminWalletController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin/wallet'),
    __metadata("design:paramtypes", [wallet_service_1.WalletService])
], AdminWalletController);
//# sourceMappingURL=admin-wallet.controller.js.map