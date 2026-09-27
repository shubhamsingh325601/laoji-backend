"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseCacheService = exports.RESPONSE_CACHE_TTL_MS = void 0;
const common_1 = require("@nestjs/common");
exports.RESPONSE_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 2000;
let ResponseCacheService = class ResponseCacheService {
    entries = new Map();
    get(key) {
        const entry = this.entries.get(key);
        if (!entry)
            return { hit: false };
        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return { hit: false };
        }
        return { hit: true, value: entry.value };
    }
    set(key, value, ttlMs = exports.RESPONSE_CACHE_TTL_MS) {
        this.entries.delete(key);
        if (this.entries.size >= MAX_ENTRIES) {
            const oldest = this.entries.keys().next().value;
            if (oldest !== undefined)
                this.entries.delete(oldest);
        }
        this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    clear() {
        this.entries.clear();
    }
};
exports.ResponseCacheService = ResponseCacheService;
exports.ResponseCacheService = ResponseCacheService = __decorate([
    (0, common_1.Injectable)()
], ResponseCacheService);
//# sourceMappingURL=response-cache.service.js.map