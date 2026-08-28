"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const cloudinary_1 = require("cloudinary");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const notification_service_1 = require("../notification/notification.service");
const kyc_status_1 = require("../notification/templates/email/kyc-status");
let UploadsService = class UploadsService {
    db;
    config;
    notifications;
    cloudName;
    apiKey;
    apiSecret;
    env;
    constructor(db, config, notifications) {
        this.db = db;
        this.config = config;
        this.notifications = notifications;
        this.cloudName = this.config.get('CLOUDINARY_CLOUD_NAME') ?? '';
        this.apiKey = this.config.get('CLOUDINARY_API_KEY') ?? '';
        this.apiSecret = this.config.get('CLOUDINARY_API_SECRET') ?? '';
        this.env = this.config.get('NODE_ENV') ?? 'development';
        if (!this.cloudName || !this.apiKey || !this.apiSecret) {
            throw new common_1.InternalServerErrorException('Cloudinary is not configured — set CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET');
        }
        cloudinary_1.v2.config({ cloud_name: this.cloudName, api_key: this.apiKey, api_secret: this.apiSecret });
    }
    signUpload(userId, type) {
        const folder = `laoji/${this.env}/${userId}/${type}`;
        const timestamp = Math.round(Date.now() / 1000);
        const signature = cloudinary_1.v2.utils.api_sign_request({ folder, timestamp }, this.apiSecret);
        return { signature, timestamp, apiKey: this.apiKey, cloudName: this.cloudName, folder };
    }
    async saveKycDocument(userId, role, input) {
        const [row] = await this.db
            .insert(schema_1.kycDocuments)
            .values({ userId, role, ...input })
            .returning();
        return row;
    }
    async listMyKycDocuments(userId) {
        return this.db
            .select()
            .from(schema_1.kycDocuments)
            .where((0, drizzle_orm_1.eq)(schema_1.kycDocuments.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.kycDocuments.uploadedAt));
    }
    async listAllKycDocuments(status) {
        return this.db
            .select()
            .from(schema_1.kycDocuments)
            .where(status ? (0, drizzle_orm_1.eq)(schema_1.kycDocuments.status, status) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.kycDocuments.uploadedAt));
    }
    async reviewKycDocument(adminUserId, docId, status, rejectionReason) {
        const [doc] = await this.db.select().from(schema_1.kycDocuments).where((0, drizzle_orm_1.eq)(schema_1.kycDocuments.id, docId)).limit(1);
        if (!doc)
            throw new common_1.NotFoundException('KYC document not found');
        const [updated] = await this.db
            .update(schema_1.kycDocuments)
            .set({ status, rejectionReason: status === 'rejected' ? (rejectionReason ?? null) : null, reviewedBy: adminUserId, reviewedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.kycDocuments.id, docId))
            .returning();
        const rolledUp = await this.rollUpKycStatus(doc.userId, doc.role);
        if (rolledUp === 'verified') {
            this.notifications.notifyEmail(doc.userId, 'kyc_approved', (0, kyc_status_1.kycApprovedEmail)());
        }
        else if (rolledUp === 'rejected') {
            this.notifications.notifyEmail(doc.userId, 'kyc_rejected', (0, kyc_status_1.kycRejectedEmail)(updated.rejectionReason ?? undefined));
        }
        return { document: updated, rolledUpStatus: rolledUp };
    }
    async rollUpKycStatus(userId, role) {
        const docs = await this.db.select().from(schema_1.kycDocuments).where((0, drizzle_orm_1.eq)(schema_1.kycDocuments.userId, userId));
        const rolledUp = docs.some((d) => d.status === 'rejected')
            ? 'rejected'
            : docs.length > 0 && docs.every((d) => d.status === 'verified')
                ? 'verified'
                : 'pending';
        if (role === 'vendor') {
            await this.db.update(schema_1.vendors).set({ kycStatus: rolledUp }).where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, userId));
        }
        else if (role === 'delivery_partner') {
            await this.db.update(schema_1.deliveryPartners).set({ kycStatus: rolledUp }).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.userId, userId));
        }
        return rolledUp;
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService,
        notification_service_1.NotificationService])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map