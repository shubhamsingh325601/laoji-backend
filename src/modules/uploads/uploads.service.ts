import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { kycDocuments } from '../../../drizzle/schema';
import type { UserRole } from '../auth/auth.types';
import type { UploadType } from './dto/signature-request.dto';

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
    const [row] = await this.db
      .insert(kycDocuments)
      .values({ userId, role, ...input })
      .returning();
    return row;
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
}
