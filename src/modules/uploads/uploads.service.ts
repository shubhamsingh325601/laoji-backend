import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { deliveryPartners, kycDocuments, vendors } from '../../../drizzle/schema';
import type { UserRole } from '../auth/auth.types';
import type { UploadType } from './dto/signature-request.dto';
import { NotificationService } from '../notification/notification.service';
import { kycApprovedEmail, kycRejectedEmail } from '../notification/templates/email/kyc-status';

export interface SignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

@Injectable()
export class UploadsService {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly env: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
  ) {
    this.cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME') ?? '';
    this.apiKey = this.config.get<string>('CLOUDINARY_API_KEY') ?? '';
    this.apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET') ?? '';
    this.env = this.config.get<string>('NODE_ENV') ?? 'development';

    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary is not configured — set CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET',
      );
    }
    cloudinary.config({ cloud_name: this.cloudName, api_key: this.apiKey, api_secret: this.apiSecret });
  }

  signUpload(userId: string, type: UploadType): SignatureResponse {
    const folder = `laoji/${this.env}/${userId}/${type}`;
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, this.apiSecret);

    return { signature, timestamp, apiKey: this.apiKey, cloudName: this.cloudName, folder };
  }

  async saveKycDocument(
    userId: string,
    role: UserRole,
    input: { docType: string; secureUrl: string; publicId: string },
  ) {
    // If a document of the same docType already exists for this user, update it
    const [existing] = await this.db
      .select()
      .from(kycDocuments)
      .where(and(eq(kycDocuments.userId, userId), eq(kycDocuments.docType, input.docType)))
      .limit(1);

    let row;
    if (existing) {
      [row] = await this.db
        .update(kycDocuments)
        .set({
          secureUrl: input.secureUrl,
          publicId: input.publicId,
          status: 'pending',
          rejectionReason: null,
          reviewedBy: null,
          reviewedAt: null,
          uploadedAt: new Date(),
        })
        .where(eq(kycDocuments.id, existing.id))
        .returning();
    } else {
      [row] = await this.db
        .insert(kycDocuments)
        .values({ userId, role, ...input, status: 'pending' })
        .returning();
    }

    const rolledUpStatus = await this.rollUpKycStatus(userId, role);
    return { ...row, rolledUpStatus };
  }

  async deleteKycDocument(userId: string, docId: string) {
    const [doc] = await this.db
      .select()
      .from(kycDocuments)
      .where(and(eq(kycDocuments.id, docId), eq(kycDocuments.userId, userId)))
      .limit(1);

    if (!doc) throw new NotFoundException('KYC document not found');

    await this.db.delete(kycDocuments).where(eq(kycDocuments.id, docId));
    const rolledUpStatus = await this.rollUpKycStatus(userId, doc.role);
    return { success: true, deletedId: docId, rolledUpStatus };
  }

  async listMyKycDocuments(userId: string) {
    return this.db
      .select()
      .from(kycDocuments)
      .where(eq(kycDocuments.userId, userId))
      .orderBy(desc(kycDocuments.uploadedAt));
  }

  async listAllKycDocuments(status?: 'pending' | 'verified' | 'rejected') {
    return this.db
      .select()
      .from(kycDocuments)
      .where(status ? eq(kycDocuments.status, status) : undefined)
      .orderBy(desc(kycDocuments.uploadedAt));
  }

  async reviewKycDocument(adminUserId: string, docId: string, status: 'verified' | 'rejected', rejectionReason?: string) {
    const [doc] = await this.db.select().from(kycDocuments).where(eq(kycDocuments.id, docId)).limit(1);
    if (!doc) throw new NotFoundException('KYC document not found');

    const [updated] = await this.db
      .update(kycDocuments)
      .set({ status, rejectionReason: status === 'rejected' ? (rejectionReason ?? null) : null, reviewedBy: adminUserId, reviewedAt: new Date() })
      .where(eq(kycDocuments.id, docId))
      .returning();

    const rolledUp = await this.rollUpKycStatus(doc.userId, doc.role);
    if (rolledUp === 'verified') {
      this.notifications.notifyEmail(doc.userId, 'kyc_approved', kycApprovedEmail());
    } else if (rolledUp === 'rejected') {
      this.notifications.notifyEmail(doc.userId, 'kyc_rejected', kycRejectedEmail(updated.rejectionReason ?? undefined));
    }
    return { document: updated, rolledUpStatus: rolledUp };
  }

  private async rollUpKycStatus(userId: string, role: UserRole): Promise<'pending' | 'verified' | 'rejected'> {
    const docs = await this.db.select().from(kycDocuments).where(eq(kycDocuments.userId, userId));
    const rolledUp: 'pending' | 'verified' | 'rejected' = docs.some((d) => d.status === 'rejected')
      ? 'rejected'
      : docs.length > 0 && docs.every((d) => d.status === 'verified')
        ? 'verified'
        : 'pending';

    if (role === 'vendor') {
      await this.db.update(vendors).set({ kycStatus: rolledUp }).where(eq(vendors.userId, userId));
    } else if (role === 'delivery_partner') {
      await this.db.update(deliveryPartners).set({ kycStatus: rolledUp }).where(eq(deliveryPartners.userId, userId));
    }
    return rolledUp;
  }
}
