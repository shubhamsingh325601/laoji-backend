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
exports.DeliveryOrderController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const delivery_service_1 = require("./delivery.service");
const delivery_order_dto_1 = require("./dto/delivery-order.dto");
let DeliveryOrderController = class DeliveryOrderController {
    delivery;
    constructor(delivery) {
        this.delivery = delivery;
    }
    incoming(user) {
        return this.delivery.listIncoming(user.sub);
    }
    active(user) {
        return this.delivery.listActive(user.sub);
    }
    detail(user, type, id) {
        return this.delivery.getOrderDetailForPartner(user.sub, type, id);
    }
    accept(user, type, id) {
        return this.delivery.accept(user.sub, type, id);
    }
    reject(user, type, id) {
        return this.delivery.reject(user.sub, type, id);
    }
    advance(user, type, id, dto) {
        return this.delivery.advance(user.sub, type, id, dto.status);
    }
    verifyDelivery(user, type, id, dto) {
        return this.delivery.verifyDelivery(user.sub, type, id, dto.otp);
    }
};
exports.DeliveryOrderController = DeliveryOrderController;
__decorate([
    (0, common_1.Get)('incoming'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DeliveryOrderController.prototype, "incoming", null);
__decorate([
    (0, common_1.Get)('active'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DeliveryOrderController.prototype, "active", null);
__decorate([
    (0, common_1.Get)(':type/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], DeliveryOrderController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':type/:id/accept'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], DeliveryOrderController.prototype, "accept", null);
__decorate([
    (0, common_1.Post)(':type/:id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], DeliveryOrderController.prototype, "reject", null);
__decorate([
    (0, common_1.Patch)(':type/:id/advance'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, delivery_order_dto_1.AdvanceDeliveryStatusDto]),
    __metadata("design:returntype", void 0)
], DeliveryOrderController.prototype, "advance", null);
__decorate([
    (0, throttler_1.Throttle)({ deliveryOtpVerify: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)(':type/:id/verify-delivery'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, delivery_order_dto_1.VerifyDeliveryDto]),
    __metadata("design:returntype", void 0)
], DeliveryOrderController.prototype, "verifyDelivery", null);
exports.DeliveryOrderController = DeliveryOrderController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('delivery_partner'),
    (0, common_1.Controller)('delivery/orders'),
    __metadata("design:paramtypes", [delivery_service_1.DeliveryService])
], DeliveryOrderController);
//# sourceMappingURL=delivery-order.controller.js.map