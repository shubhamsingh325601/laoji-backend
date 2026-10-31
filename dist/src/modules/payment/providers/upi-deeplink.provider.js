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
exports.UpiDeepLinkProvider = exports.PLATFORM_KEY_CUSTOMER_UPI_PAYEE = exports.PLATFORM_KEY_CUSTOMER_UPI_VPA = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../../config/database.module");
const schema_1 = require("../../../../drizzle/schema");
exports.PLATFORM_KEY_CUSTOMER_UPI_VPA = 'customer_upi_vpa';
exports.PLATFORM_KEY_CUSTOMER_UPI_PAYEE = 'customer_upi_payee_name';
let UpiDeepLinkProvider = class UpiDeepLinkProvider {
    config;
    db;
    constructor(config, db) {
        this.config = config;
        this.db = db;
    }
    async initiate({ orderId, amount }) {
        let vpa = this.config.get('UPI_VPA') || '8005949152-3@ybl';
        let payeeName = this.config.get('UPI_PAYEE_NAME') || 'Laoji';
        if (this.db) {
            try {
                const rows = await this.db
                    .select({ key: schema_1.platformSettings.key, value: schema_1.platformSettings.value })
                    .from(schema_1.platformSettings)
                    .where((0, drizzle_orm_1.inArray)(schema_1.platformSettings.key, [
                    exports.PLATFORM_KEY_CUSTOMER_UPI_VPA,
                    exports.PLATFORM_KEY_CUSTOMER_UPI_PAYEE,
                ]));
                for (const r of rows) {
                    if (r.key === exports.PLATFORM_KEY_CUSTOMER_UPI_VPA && r.value?.trim()) {
                        vpa = r.value.trim();
                    }
                    else if (r.key === exports.PLATFORM_KEY_CUSTOMER_UPI_PAYEE && r.value?.trim()) {
                        payeeName = r.value.trim();
                    }
                }
            }
            catch {
            }
        }
        const params = {
            pa: vpa,
            pn: payeeName,
            am: amount.toFixed(2),
            tr: orderId,
            tn: `Laoji Order ${orderId.slice(0, 8).toUpperCase()}`,
            cu: 'INR',
        };
        const query = Object.entries(params)
            .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%40/g, '@')}`)
            .join('&');
        return {
            status: 'pending',
            upiDeepLink: `upi://pay?${query}`,
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
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [config_1.ConfigService, Object])
], UpiDeepLinkProvider);
//# sourceMappingURL=upi-deeplink.provider.js.map