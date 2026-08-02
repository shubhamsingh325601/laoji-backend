import { IsIn, IsOptional, IsString } from 'class-validator';

export const KYC_REVIEW_STATUSES = ['verified', 'rejected'] as const;

export class ReviewKycDocumentDto {
  @IsIn(KYC_REVIEW_STATUSES)
  status: (typeof KYC_REVIEW_STATUSES)[number];

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
