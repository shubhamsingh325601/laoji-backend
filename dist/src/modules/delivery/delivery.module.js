"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryModule = void 0;
const common_1 = require("@nestjs/common");
const allocation_module_1 = require("../allocation/allocation.module");
const payment_module_1 = require("../payment/payment.module");
const notification_module_1 = require("../notification/notification.module");
const revenue_module_1 = require("../revenue/revenue.module");
const delivery_service_1 = require("./delivery.service");
const delivery_partner_controller_1 = require("./delivery-partner.controller");
const delivery_order_controller_1 = require("./delivery-order.controller");
const delivery_earnings_controller_1 = require("./delivery-earnings.controller");
const admin_delivery_controller_1 = require("./admin-delivery.controller");
let DeliveryModule = class DeliveryModule {
};
exports.DeliveryModule = DeliveryModule;
exports.DeliveryModule = DeliveryModule = __decorate([
    (0, common_1.Module)({
        imports: [allocation_module_1.AllocationModule, payment_module_1.PaymentModule, notification_module_1.NotificationModule, revenue_module_1.RevenueModule],
        controllers: [delivery_partner_controller_1.DeliveryPartnerController, delivery_order_controller_1.DeliveryOrderController, delivery_earnings_controller_1.DeliveryEarningsController, admin_delivery_controller_1.AdminDeliveryController],
        providers: [delivery_service_1.DeliveryService],
        exports: [delivery_service_1.DeliveryService],
    })
], DeliveryModule);
//# sourceMappingURL=delivery.module.js.map