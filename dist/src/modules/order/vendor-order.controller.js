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
exports.VendorOrderController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const order_service_1 = require("./order.service");
const advance_status_dto_1 = require("./dto/advance-status.dto");
let VendorOrderController = class VendorOrderController {
    orders;
    constructor(orders) {
        this.orders = orders;
    }
    groceryIncoming(user) {
        return this.orders.listVendorIncomingGroceryOrders(user.sub);
    }
    groceryActive(user) {
        return this.orders.listVendorActiveGroceryOrders(user.sub);
    }
    groceryHistory(user) {
        return this.orders.listVendorHistoryGroceryOrders(user.sub);
    }
    groceryOrder(user, id) {
        return this.orders.getGroceryOrder(id, { userId: user.sub, role: user.role });
    }
    acceptGrocery(user, id) {
        return this.orders.acceptGroceryOrder(user.sub, id);
    }
    rejectGrocery(user, id) {
        return this.orders.rejectGroceryOrder(user.sub, id);
    }
    advanceGrocery(user, id, dto) {
        return this.orders.advanceGroceryOrder(user.sub, id, dto);
    }
    correctGrocery(user, id, dto) {
        return this.orders.correctGroceryOrderStatus(user.sub, id, dto);
    }
    foodIncoming(user) {
        return this.orders.listVendorIncomingFoodOrders(user.sub);
    }
    foodActive(user) {
        return this.orders.listVendorActiveFoodOrders(user.sub);
    }
    foodHistory(user) {
        return this.orders.listVendorHistoryFoodOrders(user.sub);
    }
    foodOrder(user, id) {
        return this.orders.getFoodOrder(id, { userId: user.sub, role: user.role });
    }
    acceptFood(user, id) {
        return this.orders.acceptFoodOrder(user.sub, id);
    }
    rejectFood(user, id) {
        return this.orders.rejectFoodOrder(user.sub, id);
    }
    advanceFood(user, id, dto) {
        return this.orders.advanceFoodOrder(user.sub, id, dto);
    }
    correctFood(user, id, dto) {
        return this.orders.correctFoodOrderStatus(user.sub, id, dto);
    }
};
exports.VendorOrderController = VendorOrderController;
__decorate([
    (0, common_1.Get)('grocery/incoming'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "groceryIncoming", null);
__decorate([
    (0, common_1.Get)('grocery/active'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "groceryActive", null);
__decorate([
    (0, common_1.Get)('grocery/history'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "groceryHistory", null);
__decorate([
    (0, common_1.Get)('grocery/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "groceryOrder", null);
__decorate([
    (0, common_1.Post)('grocery/:id/accept'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "acceptGrocery", null);
__decorate([
    (0, common_1.Post)('grocery/:id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "rejectGrocery", null);
__decorate([
    (0, common_1.Patch)('grocery/:id/advance'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, advance_status_dto_1.AdvanceStatusDto]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "advanceGrocery", null);
__decorate([
    (0, common_1.Patch)('grocery/:id/correct-status'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, advance_status_dto_1.CorrectStatusDto]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "correctGrocery", null);
__decorate([
    (0, common_1.Get)('food/incoming'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "foodIncoming", null);
__decorate([
    (0, common_1.Get)('food/active'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "foodActive", null);
__decorate([
    (0, common_1.Get)('food/history'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "foodHistory", null);
__decorate([
    (0, common_1.Get)('food/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "foodOrder", null);
__decorate([
    (0, common_1.Post)('food/:id/accept'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "acceptFood", null);
__decorate([
    (0, common_1.Post)('food/:id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "rejectFood", null);
__decorate([
    (0, common_1.Patch)('food/:id/advance'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, advance_status_dto_1.AdvanceStatusDto]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "advanceFood", null);
__decorate([
    (0, common_1.Patch)('food/:id/correct-status'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, advance_status_dto_1.CorrectStatusDto]),
    __metadata("design:returntype", void 0)
], VendorOrderController.prototype, "correctFood", null);
exports.VendorOrderController = VendorOrderController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('vendor'),
    (0, common_1.Controller)('vendor/orders'),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], VendorOrderController);
//# sourceMappingURL=vendor-order.controller.js.map