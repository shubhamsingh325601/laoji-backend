export declare const DELIVERY_FORWARD_STATUSES: readonly ["picked_up", "out_for_delivery"];
export declare class AdvanceDeliveryStatusDto {
    status: (typeof DELIVERY_FORWARD_STATUSES)[number];
}
export declare class VerifyDeliveryDto {
    otp: string;
}
