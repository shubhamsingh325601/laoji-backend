"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentModule = void 0;
const common_1 = require("@nestjs/common");
const revenue_module_1 = require("../revenue/revenue.module");
const payment_service_1 = require("./payment.service");
const upi_deeplink_provider_1 = require("./providers/upi-deeplink.provider");
const cod_provider_1 = require("./providers/cod.provider");
const razorpay_provider_1 = require("./providers/razorpay.provider");
const customer_payment_controller_1 = require("./customer-payment.controller");
const admin_payment_controller_1 = require("./admin-payment.controller");
let PaymentModule = class PaymentModule {
};
exports.PaymentModule = PaymentModule;
exports.PaymentModule = PaymentModule = __decorate([
    (0, common_1.Module)({
        imports: [revenue_module_1.RevenueModule],
        controllers: [customer_payment_controller_1.CustomerPaymentController, admin_payment_controller_1.AdminPaymentController],
        providers: [payment_service_1.PaymentService, upi_deeplink_provider_1.UpiDeepLinkProvider, cod_provider_1.CodProvider, razorpay_provider_1.RazorpayProvider],
        exports: [payment_service_1.PaymentService],
    })
], PaymentModule);
//# sourceMappingURL=payment.module.js.map