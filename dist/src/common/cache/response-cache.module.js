"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseCacheModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const cache_invalidation_interceptor_1 = require("./cache-invalidation.interceptor");
const response_cache_interceptor_1 = require("./response-cache.interceptor");
const response_cache_service_1 = require("./response-cache.service");
let ResponseCacheModule = class ResponseCacheModule {
};
exports.ResponseCacheModule = ResponseCacheModule;
exports.ResponseCacheModule = ResponseCacheModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            response_cache_service_1.ResponseCacheService,
            response_cache_interceptor_1.ResponseCacheInterceptor,
            { provide: core_1.APP_INTERCEPTOR, useClass: cache_invalidation_interceptor_1.CacheInvalidationInterceptor },
        ],
        exports: [response_cache_service_1.ResponseCacheService, response_cache_interceptor_1.ResponseCacheInterceptor],
    })
], ResponseCacheModule);
//# sourceMappingURL=response-cache.module.js.map