"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.outForDeliveryCustomerPush = outForDeliveryCustomerPush;
function outForDeliveryCustomerPush(orderCode, orderId, type = 'grocery', otp) {
    return {
        title: 'Out for delivery',
        body: otp
            ? `Order ${orderCode} is out for delivery. Share OTP ${otp} with the delivery partner when it arrives.`
            : `Order ${orderCode} is out for delivery — hang tight!`,
        data: {
            event: 'out_for_delivery',
            orderCode,
            ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
        },
    };
}
//# sourceMappingURL=out-for-delivery.js.map