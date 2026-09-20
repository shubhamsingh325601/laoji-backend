export declare const UPLOAD_TYPES: readonly ["kyc", "products", "menu", "suggestions", "business"];
export type UploadType = (typeof UPLOAD_TYPES)[number];
export declare class SignatureRequestDto {
    type: UploadType;
}
