"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DELIVERY_ASSIGNMENT_ATTEMPTS = exports.DELIVERY_SLA_SECONDS = void 0;
exports.DELIVERY_SLA_SECONDS = Number(process.env.DELIVERY_SLA_SECONDS ?? 120);
exports.MAX_DELIVERY_ASSIGNMENT_ATTEMPTS = Number(process.env.MAX_DELIVERY_ASSIGNMENT_ATTEMPTS ?? 3);
//# sourceMappingURL=delivery.constants.js.map