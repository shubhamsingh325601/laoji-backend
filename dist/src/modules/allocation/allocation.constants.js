"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ALLOCATION_ATTEMPTS = exports.ALLOCATION_SLA_SECONDS = void 0;
exports.ALLOCATION_SLA_SECONDS = Number(process.env.ALLOCATION_SLA_SECONDS ?? 120);
exports.MAX_ALLOCATION_ATTEMPTS = Number(process.env.MAX_ALLOCATION_ATTEMPTS ?? 3);
//# sourceMappingURL=allocation.constants.js.map