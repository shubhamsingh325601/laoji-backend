export declare const KYC_REVIEW_STATUSES: readonly ["verified", "rejected"];
export declare class ReviewKycDocumentDto {
    status: (typeof KYC_REVIEW_STATUSES)[number];
    rejectionReason?: string;
}
