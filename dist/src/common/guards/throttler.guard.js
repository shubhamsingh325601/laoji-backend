"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppThrottlerGuard = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
let AppThrottlerGuard = class AppThrottlerGuard extends throttler_1.ThrottlerGuard {
    async handleRequest(requestProps) {
        const { throttler, context } = requestProps;
        const req = context.switchToHttp().getRequest();
        const url = req.originalUrl || req.url || '';
        if (url.includes('/admin/')) {
            return true;
        }
        if (throttler.name !== 'default') {
            const handler = context.getHandler();
            const classRef = context.getClass();
            const routeLimit = this.reflector.getAllAndOverride(`THROTTLER:LIMIT${throttler.name}`, [handler, classRef]);
            if (routeLimit === undefined) {
                return true;
            }
        }
        return super.handleRequest(requestProps);
    }
};
exports.AppThrottlerGuard = AppThrottlerGuard;
exports.AppThrottlerGuard = AppThrottlerGuard = __decorate([
    (0, common_1.Injectable)()
], AppThrottlerGuard);
//# sourceMappingURL=throttler.guard.js.map