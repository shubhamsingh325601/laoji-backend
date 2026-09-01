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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("./auth.service");
const request_otp_dto_1 = require("./dto/request-otp.dto");
const verify_otp_dto_1 = require("./dto/verify-otp.dto");
const refresh_token_dto_1 = require("./dto/refresh-token.dto");
const admin_login_dto_1 = require("./dto/admin-login.dto");
const vendor_login_dto_1 = require("./dto/vendor-login.dto");
const vendor_register_dto_1 = require("./dto/vendor-register.dto");
const forgot_password_dto_1 = require("./dto/forgot-password.dto");
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    requestOtp(dto) {
        return this.auth.requestOtp(dto.phone, dto.role);
    }
    verifyOtp(dto) {
        return this.auth.verifyOtp(dto.phone, dto.role, dto.code, dto.deviceId);
    }
    refresh(dto) {
        return this.auth.refresh(dto.refreshToken);
    }
    adminLogin(dto) {
        return this.auth.adminLogin(dto.email, dto.password);
    }
    vendorLogin(dto) {
        return this.auth.vendorLogin(dto.phone, dto.password, dto.deviceId);
    }
    vendorRegister(dto) {
        return this.auth.vendorRegister(dto);
    }
    forgotPasswordRequest(dto) {
        return this.auth.requestForgotPassword(dto.phone, dto.role ?? 'vendor');
    }
    forgotPasswordReset(dto) {
        return this.auth.resetPasswordWithOtp(dto.phone, dto.code, dto.newPassword, dto.role ?? 'vendor');
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, throttler_1.Throttle)({ otpRequest: { limit: 3, ttl: 60_000 } }),
    (0, common_1.Post)('otp/request'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_otp_dto_1.RequestOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "requestOtp", null);
__decorate([
    (0, throttler_1.Throttle)({ otpVerify: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)('otp/verify'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_otp_dto_1.VerifyOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyOtp", null);
__decorate([
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_token_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, throttler_1.Throttle)({ adminLogin: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)('admin/login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_login_dto_1.AdminLoginDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "adminLogin", null);
__decorate([
    (0, throttler_1.Throttle)({ vendorLogin: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)('vendor/login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [vendor_login_dto_1.VendorLoginDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "vendorLogin", null);
__decorate([
    (0, throttler_1.Throttle)({ vendorLogin: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)('vendor/register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [vendor_register_dto_1.VendorRegisterDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "vendorRegister", null);
__decorate([
    (0, throttler_1.Throttle)({ forgotPassword: { limit: 5, ttl: 60_000 } }),
    (0, common_1.Post)('forgot-password/request'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forgot_password_dto_1.ForgotPasswordRequestDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "forgotPasswordRequest", null);
__decorate([
    (0, throttler_1.Throttle)({ forgotPassword: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)('forgot-password/reset'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forgot_password_dto_1.ForgotPasswordResetDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "forgotPasswordReset", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map