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
exports.CustomerOrderController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const order_service_1 = require("./order.service");
const create_grocery_order_dto_1 = require("./dto/create-grocery-order.dto");
const create_food_order_dto_1 = require("./dto/create-food-order.dto");
const rate_food_order_dto_1 = require("./dto/rate-food-order.dto");
let CustomerOrderController = class CustomerOrderController {
    orders;
    constructor(orders) {
        this.orders = orders;
    }
    createGrocery(user, dto) {
        return this.orders.createGroceryOrder(user.sub, dto);
    }
    myGroceryOrders(user) {
        return this.orders.listMyGroceryOrders(user.sub);
    }
    groceryOrder(user, id) {
        return this.orders.getGroceryOrder(id, { userId: user.sub, role: user.role });
    }
    createFood(user, dto) {
        return this.orders.createFoodOrder(user.sub, dto);
    }
    myFoodOrders(user) {
        return this.orders.listMyFoodOrders(user.sub);
    }
    foodOrder(user, id) {
        return this.orders.getFoodOrder(id, { userId: user.sub, role: user.role });
    }
    rateFoodOrder(user, id, dto) {
        return this.orders.rateFoodOrder(user.sub, id, dto);
    }
    cancelOrder(user, type, id) {
        return this.orders.cancelOrderForCustomer(user.sub, type, id);
    }
};
exports.CustomerOrderController = CustomerOrderController;
__decorate([
    (0, throttler_1.Throttle)({ orderCreate: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)('grocery'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_grocery_order_dto_1.CreateGroceryOrderDto]),
    __metadata("design:returntype", void 0)
], CustomerOrderController.prototype, "createGrocery", null);
__decorate([
    (0, common_1.Get)('grocery'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CustomerOrderController.prototype, "myGroceryOrders", null);
__decorate([
    (0, common_1.Get)('grocery/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CustomerOrderController.prototype, "groceryOrder", null);
__decorate([
    (0, throttler_1.Throttle)({ orderCreate: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)('food'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_food_order_dto_1.CreateFoodOrderDto]),
    __metadata("design:returntype", void 0)
], CustomerOrderController.prototype, "createFood", null);
__decorate([
    (0, common_1.Get)('food'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CustomerOrderController.prototype, "myFoodOrders", null);
__decorate([
    (0, common_1.Get)('food/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CustomerOrderController.prototype, "foodOrder", null);
__decorate([
    (0, common_1.Post)('food/:id/rating'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rate_food_order_dto_1.RateFoodOrderDto]),
    __metadata("design:returntype", void 0)
], CustomerOrderController.prototype, "rateFoodOrder", null);
__decorate([
    (0, common_1.Post)(':type/:id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CustomerOrderController.prototype, "cancelOrder", null);
exports.CustomerOrderController = CustomerOrderController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('customer'),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], CustomerOrderController);
//# sourceMappingURL=customer-order.controller.js.map