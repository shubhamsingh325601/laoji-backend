"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.outForDeliveryCustomerPush = outForDeliveryCustomerPush;
function outForDeliveryCustomerPush(orderCode) {
    return {
        title: 'Out for delivery',
        body: `Order ${orderCode} is out for delivery — hang tight!`,
        data: { event: 'out_for_delivery', orderCode },
    };
}
//# sourceMappingURL=out-for-delivery.js.map