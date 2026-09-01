import { ConfigService } from '@nestjs/config';
import type { Db } from '../../config/database.module';
import type { UserRole } from '../auth/auth.types';
import type { UploadType } from './dto/signature-request.dto';
import { NotificationService } from '../notification/notification.service';
export interface SignatureResponse {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
}
export declare class UploadsService {
    private readonly db;
    private readonly config;
    private readonly notifications;
    private readonly cloudName;
    private readonly apiKey;
    private readonly apiSecret;
    private readonly env;
    constructor(db: Db, config: ConfigService, notifications: NotificationService);
    signUpload(userId: string, type: UploadType): SignatureResponse;
    saveKycDocument(userId: string, role: UserRole, input: {
        docType: string;
        secureUrl: string;
        publicId: string;
    }): Promise<any>;
    deleteKycDocument(userId: string, docId: string): Promise<{
        success: boolean;
        deletedId: string;
        rolledUpStatus: "pending" | "verified" | "rejected";
    }>;
    listMyKycDocuments(userId: string): Promise<{
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
    listAllKycDocuments(status?: 'pending' | 'verified' | 'rejected'): Promise<{
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
    reviewKycDocument(adminUserId: string, docId: string, status: 'verified' | 'rejected', rejectionReason?: string): Promise<{
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
    private rollUpKycStatus;
}
