"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocationFailedAdminEmail = allocationFailedAdminEmail;
function allocationFailedAdminEmail(orderCode) {
    return {
        subject: `Allocation failed — order ${orderCode}`,
        html: `<p>Order <strong>${orderCode}</strong> could not be allocated to any vendor after exhausting all reallocation attempts. The order has been marked failed.</p>`,
    };
}
//# sourceMappingURL=allocation-failed-admin.js.map