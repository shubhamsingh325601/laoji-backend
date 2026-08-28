export declare const UPLOAD_TYPES: readonly ["kyc", "products", "menu", "suggestions"];
export type UploadType = (typeof UPLOAD_TYPES)[number];
export declare class SignatureRequestDto {
    type: UploadType;
}
