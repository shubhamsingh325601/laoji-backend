import type { JwtAccessPayload } from '../auth/auth.types';
import { UploadsService } from './uploads.service';
import { SignatureRequestDto } from './dto/signature-request.dto';
import { SaveKycDocumentDto } from './dto/save-kyc-document.dto';
import { ReviewKycDocumentDto } from './dto/review-kyc-document.dto';
export declare class UploadsController {
    private readonly uploads;
    constructor(uploads: UploadsService);
    getSignature(user: JwtAccessPayload, dto: SignatureRequestDto): import("./uploads.service").SignatureResponse;
    saveKycDocument(user: JwtAccessPayload, dto: SaveKycDocumentDto): Promise<{
        id: string;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        status: "pending" | "verified" | "rejected";
        userId: string;
        docType: string;
        secureUrl: string;
        publicId: string;
        rejectionReason: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        uploadedAt: Date;
    }>;
    myKycDocuments(user: JwtAccessPayload): Promise<{
        id: string;
        userId: string;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        docType: string;
        secureUrl: string;
        publicId: string;
        status: "pending" | "verified" | "rejected";
        rejectionReason: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        uploadedAt: Date;
    }[]>;
    allKycDocuments(status?: 'pending' | 'verified' | 'rejected'): Promise<{
        id: string;
        userId: string;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        docType: string;
        secureUrl: string;
        publicId: string;
        status: "pending" | "verified" | "rejected";
        rejectionReason: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        uploadedAt: Date;
    }[]>;
    reviewKycDocument(user: JwtAccessPayload, id: string, dto: ReviewKycDocumentDto): Promise<{
        document: {
            id: string;
            userId: string;
            role: "customer" | "vendor" | "delivery_partner" | "admin";
            docType: string;
            secureUrl: string;
            publicId: string;
            status: "pending" | "verified" | "rejected";
            rejectionReason: string | null;
            reviewedBy: string | null;
            reviewedAt: Date | null;
            uploadedAt: Date;
        };
        rolledUpStatus: "pending" | "verified" | "rejected";
    }>;
}
