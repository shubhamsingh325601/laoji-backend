"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderModule = void 0;
const common_1 = require("@nestjs/common");
const allocation_module_1 = require("../allocation/allocation.module");
const catalog_module_1 = require("../catalog/catalog.module");
const delivery_module_1 = require("../delivery/delivery.module");
const payment_module_1 = require("../payment/payment.module");
const notification_module_1 = require("../notification/notification.module");
const revenue_module_1 = require("../revenue/revenue.module");
const order_service_1 = require("./order.service");
const customer_order_controller_1 = require("./customer-order.controller");
const vendor_order_controller_1 = require("./vendor-order.controller");
const admin_order_controller_1 = require("./admin-order.controller");
let OrderModule = class OrderModule {
};
exports.OrderModule = OrderModule;
exports.OrderModule = OrderModule = __decorate([
    (0, common_1.Module)({
        imports: [allocation_module_1.AllocationModule, catalog_module_1.CatalogModule, delivery_module_1.DeliveryModule, payment_module_1.PaymentModule, notification_module_1.NotificationModule, revenue_module_1.RevenueModule],
        controllers: [customer_order_controller_1.CustomerOrderController, vendor_order_controller_1.VendorOrderController, admin_order_controller_1.AdminOrderController],
        providers: [order_service_1.OrderService],
    })
], OrderModule);
//# sourceMappingURL=order.module.js.map