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
exports.SendAdminNotificationDto = exports.NOTIFICATION_CHANNELS = exports.NOTIFICATION_TARGETS = void 0;
const class_validator_1 = require("class-validator");
exports.NOTIFICATION_TARGETS = ['all', 'customer', 'vendor', 'restaurant', 'delivery_partner', 'user'];
exports.NOTIFICATION_CHANNELS = ['push', 'email', 'sms', 'all'];
class SendAdminNotificationDto {
    target;
    channel;
    channels;
    userId;
    phone;
    email;
    title;
    message;
}
exports.SendAdminNotificationDto = SendAdminNotificationDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.NOTIFICATION_TARGETS),
    __metadata("design:type", String)
], SendAdminNotificationDto.prototype, "target", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.NOTIFICATION_CHANNELS),
    __metadata("design:type", String)
], SendAdminNotificationDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SendAdminNotificationDto.prototype, "channels", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendAdminNotificationDto.prototype, "userId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendAdminNotificationDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], SendAdminNotificationDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], SendAdminNotificationDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 4000),
    __metadata("design:type", String)
], SendAdminNotificationDto.prototype, "message", void 0);
//# sourceMappingURL=send-admin-notification.dto.js.map