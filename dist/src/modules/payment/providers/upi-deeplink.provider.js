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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpiDeepLinkProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let UpiDeepLinkProvider = class UpiDeepLinkProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async initiate({ orderId, amount }) {
        const vpa = this.config.get('UPI_VPA');
        const payeeName = this.config.get('UPI_PAYEE_NAME');
        const params = new URLSearchParams({
            pa: vpa,
            pn: payeeName,
            am: amount.toFixed(2),
            tr: orderId,
            cu: 'INR',
        });
        return {
            status: 'pending',
            upiDeepLink: `upi://pay?${params.toString()}`,
            providerRef: orderId,
        };
    }
    async verify(_params) {
        throw new Error('UpiDeepLinkProvider cannot auto-verify payments — no PSP webhook exists at MVP. Use customer self-confirmation or admin manual reconciliation instead.');
    }
    async refund(_params) {
        throw new Error('UpiDeepLinkProvider cannot issue refunds programmatically — no gateway integration at MVP.');
    }
};
exports.UpiDeepLinkProvider = UpiDeepLinkProvider;
exports.UpiDeepLinkProvider = UpiDeepLinkProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UpiDeepLinkProvider);
//# sourceMappingURL=upi-deeplink.provider.js.map