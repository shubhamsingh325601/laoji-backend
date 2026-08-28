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
exports.AdminPaymentController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const payment_service_1 = require("./payment.service");
const reconcile_payment_dto_1 = require("./dto/reconcile-payment.dto");
let AdminPaymentController = class AdminPaymentController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    listPending() {
        return this.payments.listPendingForAdmin();
    }
    reconcile(user, id, dto) {
        return this.payments.reconcile(id, user.sub, dto.status);
    }
    listRefunds() {
        return this.payments.listRefundsForAdmin();
    }
    markRefunded(user, id) {
        return this.payments.markRefunded(id, user.sub);
    }
};
exports.AdminPaymentController = AdminPaymentController;
__decorate([
    (0, common_1.Get)('pending'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPaymentController.prototype, "listPending", null);
__decorate([
    (0, common_1.Post)(':id/reconcile'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reconcile_payment_dto_1.ReconcilePaymentDto]),
    __metadata("design:returntype", void 0)
], AdminPaymentController.prototype, "reconcile", null);
__decorate([
    (0, common_1.Get)('refunds'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPaymentController.prototype, "listRefunds", null);
__decorate([
    (0, common_1.Post)(':id/mark-refunded'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminPaymentController.prototype, "markRefunded", null);
exports.AdminPaymentController = AdminPaymentController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin/payments'),
    __metadata("design:paramtypes", [payment_service_1.PaymentService])
], AdminPaymentController);
//# sourceMappingURL=admin-payment.controller.js.map