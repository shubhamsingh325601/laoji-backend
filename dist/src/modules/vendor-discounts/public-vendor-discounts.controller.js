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
exports.PublicVendorDiscountsController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const vendor_discounts_service_1 = require("./vendor-discounts.service");
let PublicVendorDiscountsController = class PublicVendorDiscountsController {
    discountsService;
    jwtService;
    config;
    constructor(discountsService, jwtService, config) {
        this.discountsService = discountsService;
        this.jwtService = jwtService;
        this.config = config;
    }
    async listActive(vendorId, req) {
        const userId = await this.userIdFrom(req);
        const rows = await this.discountsService.getActiveDiscountsForVendor(vendorId, userId);
        return rows.map((d) => ({
            id: d.id,
            vendorId: d.vendorId,
            title: d.title,
            scope: d.scope,
            productId: d.productId,
            menuItemId: d.menuItemId,
            discountType: d.discountType,
            discountValue: d.discountValue,
            maxDiscount: d.maxDiscount,
            minOrderValue: d.minOrderValue,
            startTime: d.startTime,
            endTime: d.endTime,
            startDate: d.startDate,
            endDate: d.endDate,
        }));
    }
    async userIdFrom(req) {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer '))
            return undefined;
        try {
            const payload = await this.jwtService.verifyAsync(header.slice(7), {
                secret: this.config.get('JWT_ACCESS_SECRET'),
            });
            return payload.sub;
        }
        catch {
            return undefined;
        }
    }
};
exports.PublicVendorDiscountsController = PublicVendorDiscountsController;
__decorate([
    (0, common_1.Get)('active'),
    __param(0, (0, common_1.Param)('vendorId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PublicVendorDiscountsController.prototype, "listActive", null);
exports.PublicVendorDiscountsController = PublicVendorDiscountsController = __decorate([
    (0, common_1.Controller)('vendors/:vendorId/discounts'),
    __metadata("design:paramtypes", [vendor_discounts_service_1.VendorDiscountsService,
        jwt_1.JwtService,
        config_1.ConfigService])
], PublicVendorDiscountsController);
//# sourceMappingURL=public-vendor-discounts.controller.js.map