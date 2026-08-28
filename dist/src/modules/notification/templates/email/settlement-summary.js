"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementSummaryEmail = settlementSummaryEmail;
function settlementSummaryEmail(periodLabel, gross, commission, net) {
    return {
        subject: `Your Laoji settlement — ${periodLabel}`,
        html: `<p>Gross: ₹${gross}</p><p>Platform commission: ₹${commission}</p><p><strong>Net payout: ₹${net}</strong></p>`,
    };
}
//# sourceMappingURL=settlement-summary.js.map