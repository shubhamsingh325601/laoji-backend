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
exports.UploadsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const uploads_service_1 = require("./uploads.service");
const signature_request_dto_1 = require("./dto/signature-request.dto");
const save_kyc_document_dto_1 = require("./dto/save-kyc-document.dto");
const review_kyc_document_dto_1 = require("./dto/review-kyc-document.dto");
let UploadsController = class UploadsController {
    uploads;
    constructor(uploads) {
        this.uploads = uploads;
    }
    getSignature(user, dto) {
        return this.uploads.signUpload(user.sub, dto.type);
    }
    saveKycDocument(user, dto) {
        return this.uploads.saveKycDocument(user.sub, user.role, dto);
    }
    myKycDocuments(user) {
        return this.uploads.listMyKycDocuments(user.sub);
    }
    deleteKycDocument(user, id) {
        return this.uploads.deleteKycDocument(user.sub, id);
    }
    allKycDocuments(status) {
        return this.uploads.listAllKycDocuments(status);
    }
    reviewKycDocument(user, id, dto) {
        return this.uploads.reviewKycDocument(user.sub, id, dto.status, dto.rejectionReason);
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Post)('signature'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, signature_request_dto_1.SignatureRequestDto]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "getSignature", null);
__decorate([
    (0, common_1.Post)('kyc-documents'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, save_kyc_document_dto_1.SaveKycDocumentDto]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "saveKycDocument", null);
__decorate([
    (0, common_1.Get)('kyc-documents/me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "myKycDocuments", null);
__decorate([
    (0, common_1.Delete)('kyc-documents/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "deleteKycDocument", null);
__decorate([
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Get)('kyc-documents'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "allKycDocuments", null);
__decorate([
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Patch)('kyc-documents/:id/review'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, review_kyc_document_dto_1.ReviewKycDocumentDto]),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "reviewKycDocument", null);
exports.UploadsController = UploadsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('uploads'),
    __metadata("design:paramtypes", [uploads_service_1.UploadsService])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map