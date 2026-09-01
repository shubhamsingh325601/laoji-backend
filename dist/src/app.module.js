"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const config_module_1 = require("./config/config.module");
const database_module_1 = require("./config/database.module");
const health_module_1 = require("./modules/health/health.module");
const auth_module_1 = require("./modules/auth/auth.module");
const user_module_1 = require("./modules/user/user.module");
const uploads_module_1 = require("./modules/uploads/uploads.module");
const catalog_module_1 = require("./modules/catalog/catalog.module");
const allocation_module_1 = require("./modules/allocation/allocation.module");
const delivery_module_1 = require("./modules/delivery/delivery.module");
const payment_module_1 = require("./modules/payment/payment.module");
const notification_module_1 = require("./modules/notification/notification.module");
const revenue_module_1 = require("./modules/revenue/revenue.module");
const order_module_1 = require("./modules/order/order.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_module_1.AppConfigModule,
            database_module_1.DatabaseModule,
            throttler_1.ThrottlerModule.forRoot({
                throttlers: [
                    { name: 'default', ttl: 60_000, limit: 100 },
                    { name: 'otpRequest', ttl: 60_000, limit: 3 },
                    { name: 'otpVerify', ttl: 60_000, limit: 10 },
                    { name: 'adminLogin', ttl: 60_000, limit: 10 },
                    { name: 'orderCreate', ttl: 60_000, limit: 10 },
                    { name: 'paymentInitiate', ttl: 60_000, limit: 10 },
                    { name: 'productSuggestion', ttl: 60_000, limit: 5 },
                    { name: 'supportContact', ttl: 60_000, limit: 5 },
                    { name: 'deliveryOtpVerify', ttl: 60_000, limit: 10 },
                    { name: 'vendorLogin', ttl: 60_000, limit: 10 },
                    { name: 'forgotPassword', ttl: 60_000, limit: 10 },
                    { name: 'changePassword', ttl: 60_000, limit: 10 },
                ],
            }),
            health_module_1.HealthModule,
            auth_module_1.AuthModule,
            user_module_1.UserModule,
            uploads_module_1.UploadsModule,
            catalog_module_1.CatalogModule,
            allocation_module_1.AllocationModule,
            delivery_module_1.DeliveryModule,
            payment_module_1.PaymentModule,
            notification_module_1.NotificationModule,
            revenue_module_1.RevenueModule,
            order_module_1.OrderModule,
            dashboard_module_1.DashboardModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_FILTER, useClass: http_exception_filter_1.HttpExceptionFilter },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map