"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderReceiptEmail = orderReceiptEmail;
function orderReceiptEmail(orderCode, total, items) {
    const rows = items.map((i) => `<tr><td>${i.qty}× ${i.name}</td><td>₹${i.price * i.qty}</td></tr>`).join('');
    return {
        subject: `Your Laoji receipt — order ${orderCode}`,
        html: `<p>Thanks for your order!</p><table>${rows}</table><p><strong>Total: ₹${total}</strong></p>`,
    };
}
//# sourceMappingURL=order-receipt.js.map