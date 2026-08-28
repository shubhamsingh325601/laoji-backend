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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAdminVendorDto = exports.CreateAdminVendorDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class CreateAdminVendorDto {
    businessName;
    ownerName;
    phone;
    email;
    type;
    shopAddress;
    pickupLat;
    pickupLng;
    deliveryRadiusKm;
    commissionPct;
    kycStatus;
}
exports.CreateAdminVendorDto = CreateAdminVendorDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 200),
    __metadata("design:type", String)
], CreateAdminVendorDto.prototype, "businessName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], CreateAdminVendorDto.prototype, "ownerName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 15),
    __metadata("design:type", String)
], CreateAdminVendorDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => typeof o.email === 'string' && o.email.trim().length > 0),
    (0, class_validator_1.IsEmail)(),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)),
    __metadata("design:type", String)
], CreateAdminVendorDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['grocery', 'restaurant', 'both']),
    __metadata("design:type", String)
], CreateAdminVendorDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAdminVendorDto.prototype, "shopAddress", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateAdminVendorDto.prototype, "pickupLat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateAdminVendorDto.prototype, "pickupLng", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.5),
    __metadata("design:type", Number)
], CreateAdminVendorDto.prototype, "deliveryRadiusKm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateAdminVendorDto.prototype, "commissionPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['unverified', 'pending', 'verified', 'rejected']),
    __metadata("design:type", String)
], CreateAdminVendorDto.prototype, "kycStatus", void 0);
class UpdateAdminVendorDto {
    businessName;
    ownerName;
    phone;
    email;
    type;
    shopAddress;
    deliveryRadiusKm;
    commissionPct;
    cashbackPct;
    discountPct;
    minOrderValue;
    maxDiscountCap;
    kycStatus;
    activity;
}
exports.UpdateAdminVendorDto = UpdateAdminVendorDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAdminVendorDto.prototype, "businessName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAdminVendorDto.prototype, "ownerName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAdminVendorDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => typeof o.email === 'string' && o.email.trim().length > 0),
    (0, class_validator_1.IsEmail)(),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)),
    __metadata("design:type", String)
], UpdateAdminVendorDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['grocery', 'restaurant', 'both']),
    __metadata("design:type", String)
], UpdateAdminVendorDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAdminVendorDto.prototype, "shopAddress", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAdminVendorDto.prototype, "deliveryRadiusKm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAdminVendorDto.prototype, "commissionPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAdminVendorDto.prototype, "cashbackPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAdminVendorDto.prototype, "discountPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAdminVendorDto.prototype, "minOrderValue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAdminVendorDto.prototype, "maxDiscountCap", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['unverified', 'pending', 'verified', 'rejected']),
    __metadata("design:type", String)
], UpdateAdminVendorDto.prototype, "kycStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'inactive']),
    __metadata("design:type", String)
], UpdateAdminVendorDto.prototype, "activity", void 0);
//# sourceMappingURL=admin-vendor.dto.js.map