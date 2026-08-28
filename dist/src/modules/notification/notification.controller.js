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
exports.NotificationController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const notification_service_1 = require("./notification.service");
const register_device_token_dto_1 = require("./dto/register-device-token.dto");
const contact_support_dto_1 = require("./dto/contact-support.dto");
let NotificationController = class NotificationController {
    notifications;
    constructor(notifications) {
        this.notifications = notifications;
    }
    registerDeviceToken(user, dto) {
        return this.notifications.registerDeviceToken(user.sub, dto.fcmToken, dto.platform);
    }
    async contactSupport(user, dto) {
        await this.notifications.sendSupportMessage(user.sub, user.role, dto.subject, dto.message);
        return { ok: true };
    }
};
exports.NotificationController = NotificationController;
__decorate([
    (0, common_1.Post)('device-token'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, register_device_token_dto_1.RegisterDeviceTokenDto]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "registerDeviceToken", null);
__decorate([
    (0, throttler_1.Throttle)({ supportContact: { limit: 5, ttl: 60_000 } }),
    (0, common_1.Post)('support'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, contact_support_dto_1.ContactSupportDto]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "contactSupport", null);
exports.NotificationController = NotificationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('notifications'),
    __metadata("design:paramtypes", [notification_service_1.NotificationService])
], NotificationController);
//# sourceMappingURL=notification.controller.js.map