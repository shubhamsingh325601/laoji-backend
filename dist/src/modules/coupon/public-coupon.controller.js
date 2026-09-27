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
exports.PublicCouponController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const response_cache_interceptor_1 = require("../../common/cache/response-cache.interceptor");
const coupon_service_1 = require("./coupon.service");
const validate_coupon_dto_1 = require("./dto/validate-coupon.dto");
let PublicCouponController = class PublicCouponController {
    couponService;
    jwtService;
    config;
    constructor(couponService, jwtService, config) {
        this.couponService = couponService;
        this.jwtService = jwtService;
        this.config = config;
    }
    listActive() {
        return this.couponService.listActive();
    }
    async validate(dto, req) {
        return this.couponService.validate(dto.code, dto.subtotal, await this.userIdFrom(req));
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
exports.PublicCouponController = PublicCouponController;
__decorate([
    (0, common_1.UseInterceptors)(response_cache_interceptor_1.ResponseCacheInterceptor),
    (0, common_1.Get)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicCouponController.prototype, "listActive", null);
__decorate([
    (0, common_1.Post)('validate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [validate_coupon_dto_1.ValidateCouponDto, Object]),
    __metadata("design:returntype", Promise)
], PublicCouponController.prototype, "validate", null);
exports.PublicCouponController = PublicCouponController = __decorate([
    (0, common_1.Controller)('coupons'),
    __metadata("design:paramtypes", [coupon_service_1.CouponService,
        jwt_1.JwtService,
        config_1.ConfigService])
], PublicCouponController);
//# sourceMappingURL=public-coupon.controller.js.map