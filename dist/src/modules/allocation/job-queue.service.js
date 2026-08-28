"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var JobQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobQueueService = void 0;
const common_1 = require("@nestjs/common");
let JobQueueService = JobQueueService_1 = class JobQueueService {
    logger = new common_1.Logger(JobQueueService_1.name);
    timers = new Map();
    schedule(key, delayMs, fn) {
        this.cancel(key);
        const timer = setTimeout(() => {
            this.timers.delete(key);
            Promise.resolve(fn()).catch((err) => this.logger.error(`Job ${key} failed`, err));
        }, delayMs);
        this.timers.set(key, timer);
    }
    cancel(key) {
        const timer = this.timers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(key);
        }
    }
};
exports.JobQueueService = JobQueueService;
exports.JobQueueService = JobQueueService = JobQueueService_1 = __decorate([
    (0, common_1.Injectable)()
], JobQueueService);
//# sourceMappingURL=job-queue.service.js.map