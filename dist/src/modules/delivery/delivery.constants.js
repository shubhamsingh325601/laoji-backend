"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARTNER_HEARTBEAT_MAX_AGE_MS = exports.DELIVERY_SLA_SECONDS = void 0;
exports.DELIVERY_SLA_SECONDS = Number(process.env.DELIVERY_SLA_SECONDS ?? 300);
exports.PARTNER_HEARTBEAT_MAX_AGE_MS = Number(process.env.PARTNER_HEARTBEAT_MAX_AGE_SECONDS ?? 600) * 1000;
//# sourceMappingURL=delivery.constants.js.map