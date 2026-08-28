"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModule = void 0;
const common_1 = require("@nestjs/common");
const job_queue_service_1 = require("../allocation/job-queue.service");
const notification_service_1 = require("./notification.service");
const fcm_push_provider_1 = require("./providers/fcm-push.provider");
const resend_email_provider_1 = require("./providers/resend-email.provider");
const notification_controller_1 = require("./notification.controller");
const admin_notification_controller_1 = require("./admin-notification.controller");
let NotificationModule = class NotificationModule {
};
exports.NotificationModule = NotificationModule;
exports.NotificationModule = NotificationModule = __decorate([
    (0, common_1.Module)({
        controllers: [notification_controller_1.NotificationController, admin_notification_controller_1.AdminNotificationController],
        providers: [notification_service_1.NotificationService, job_queue_service_1.JobQueueService, fcm_push_provider_1.FcmPushProvider, resend_email_provider_1.ResendEmailProvider],
        exports: [notification_service_1.NotificationService],
    })
], NotificationModule);
//# sourceMappingURL=notification.module.js.map