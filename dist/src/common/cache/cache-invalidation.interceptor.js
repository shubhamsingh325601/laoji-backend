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
exports.CacheInvalidationInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const response_cache_service_1 = require("./response-cache.service");
const INVALIDATING_PATH = /^\/api\/v1\/(admin|vendor|vendors|users\/me)(\/|$)/;
let CacheInvalidationInterceptor = class CacheInvalidationInterceptor {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        if (req.method === 'GET' || req.method === 'HEAD' || !INVALIDATING_PATH.test(req.path)) {
            return next.handle();
        }
        return next.handle().pipe((0, rxjs_1.tap)(() => this.cache.clear()));
    }
};
exports.CacheInvalidationInterceptor = CacheInvalidationInterceptor;
exports.CacheInvalidationInterceptor = CacheInvalidationInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [response_cache_service_1.ResponseCacheService])
], CacheInvalidationInterceptor);
//# sourceMappingURL=cache-invalidation.interceptor.js.map