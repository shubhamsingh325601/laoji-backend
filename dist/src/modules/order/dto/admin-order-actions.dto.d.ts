export declare const ADMIN_SETTABLE_STATUSES: readonly ["vendor_accepted", "preparing", "ready", "handed_over", "delivery_assigned", "picked_up", "out_for_delivery", "delivered"];
export declare class AdminSetStatusDto {
    status: (typeof ADMIN_SETTABLE_STATUSES)[number];
}
export declare class AdminAssignPartnerDto {
    partnerId: string;
}
