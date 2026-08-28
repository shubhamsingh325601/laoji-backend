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
exports.CustomerPaymentController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const payment_service_1 = require("./payment.service");
const initiate_payment_dto_1 = require("./dto/initiate-payment.dto");
let CustomerPaymentController = class CustomerPaymentController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    initiate(user, type, orderId, dto) {
        return this.payments.initiate(type, orderId, user.sub, dto.method);
    }
    get(user, type, orderId) {
        return this.payments.getForOrder(type, orderId, user.sub);
    }
    confirm(user, type, orderId) {
        return this.payments.confirmByCustomer(type, orderId, user.sub);
    }
};
exports.CustomerPaymentController = CustomerPaymentController;
__decorate([
    (0, throttler_1.Throttle)({ paymentInitiate: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)(':type/:orderId/initiate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('orderId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, initiate_payment_dto_1.InitiatePaymentDto]),
    __metadata("design:returntype", void 0)
], CustomerPaymentController.prototype, "initiate", null);
__decorate([
    (0, common_1.Get)(':type/:orderId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CustomerPaymentController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(':type/:orderId/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CustomerPaymentController.prototype, "confirm", null);
exports.CustomerPaymentController = CustomerPaymentController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('customer'),
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payment_service_1.PaymentService])
], CustomerPaymentController);
//# sourceMappingURL=customer-payment.controller.js.map