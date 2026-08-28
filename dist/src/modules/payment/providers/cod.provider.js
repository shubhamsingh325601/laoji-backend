"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodProvider = void 0;
const common_1 = require("@nestjs/common");
let CodProvider = class CodProvider {
    async initiate(_params) {
        return { status: 'pending_cod' };
    }
    async verify({ currentStatus }) {
        return { status: currentStatus };
    }
    async refund(_params) {
        throw new Error('COD has no digital transaction to refund — reversal is a manual/offline process.');
    }
};
exports.CodProvider = CodProvider;
exports.CodProvider = CodProvider = __decorate([
    (0, common_1.Injectable)()
], CodProvider);
//# sourceMappingURL=cod.provider.js.map