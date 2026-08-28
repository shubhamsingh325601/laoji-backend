export declare const RECONCILE_STATUSES: readonly ["paid", "failed"];
export declare class ReconcilePaymentDto {
    status: (typeof RECONCILE_STATUSES)[number];
}
