"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RazorpayProvider = void 0;
const common_1 = require("@nestjs/common");
let RazorpayProvider = class RazorpayProvider {
    async initiate(_params) {
        throw new Error('RazorpayProvider is not implemented yet — set PAYMENT_PROVIDER=upi_deeplink.');
    }
    async verify(_params) {
        throw new Error('RazorpayProvider is not implemented yet.');
    }
    async refund(_params) {
        throw new Error('RazorpayProvider is not implemented yet.');
    }
};
exports.RazorpayProvider = RazorpayProvider;
exports.RazorpayProvider = RazorpayProvider = __decorate([
    (0, common_1.Injectable)()
], RazorpayProvider);
//# sourceMappingURL=razorpay.provider.js.map