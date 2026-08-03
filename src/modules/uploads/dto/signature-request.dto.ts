import { IsIn } from 'class-validator';

// 'kyc' landed in Phase 2 (TRD Section 5); 'products' and 'menu' land here in
// Phase 3 for catalog/menu item images. 'suggestions' lands in Phase 9 for
// vendor product-suggestion photos. Extending this list is how each phase
// opts in, not a free-form string.
export const UPLOAD_TYPES = ['kyc', 'products', 'menu', 'suggestions'] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];

export class SignatureRequestDto {
  @IsIn(UPLOAD_TYPES)
  type: UploadType;
}
