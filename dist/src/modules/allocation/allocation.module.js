"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllocationModule = void 0;
const common_1 = require("@nestjs/common");
const payment_module_1 = require("../payment/payment.module");
const notification_module_1 = require("../notification/notification.module");
const allocation_service_1 = require("./allocation.service");
const job_queue_service_1 = require("./job-queue.service");
let AllocationModule = class AllocationModule {
};
exports.AllocationModule = AllocationModule;
exports.AllocationModule = AllocationModule = __decorate([
    (0, common_1.Module)({
        imports: [payment_module_1.PaymentModule, notification_module_1.NotificationModule],
        providers: [allocation_service_1.AllocationService, job_queue_service_1.JobQueueService],
        exports: [allocation_service_1.AllocationService, job_queue_service_1.JobQueueService],
    })
], AllocationModule);
//# sourceMappingURL=allocation.module.js.map