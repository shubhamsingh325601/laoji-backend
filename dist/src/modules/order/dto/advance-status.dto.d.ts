export declare const FORWARD_STATUSES: readonly ["preparing", "ready", "handed_over"];
export declare class AdvanceStatusDto {
    status: (typeof FORWARD_STATUSES)[number];
}
export declare const CORRECTABLE_STATUSES: readonly ["vendor_accepted", "preparing", "ready", "handed_over"];
export declare class CorrectStatusDto {
    status: (typeof CORRECTABLE_STATUSES)[number];
}
