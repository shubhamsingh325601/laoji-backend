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
exports.UpdateExpirySettingsDto = exports.AdjustWalletCreditExpiryDto = exports.RestoreWalletCreditDto = exports.AdjustScratchCardExpiryDto = exports.RestoreScratchCardDto = void 0;
const class_validator_1 = require("class-validator");
class RestoreScratchCardDto {
    validityDays;
    notes;
}
exports.RestoreScratchCardDto = RestoreScratchCardDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], RestoreScratchCardDto.prototype, "validityDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RestoreScratchCardDto.prototype, "notes", void 0);
class AdjustScratchCardExpiryDto {
    expiresAt;
    validityDays;
    notes;
}
exports.AdjustScratchCardExpiryDto = AdjustScratchCardExpiryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], AdjustScratchCardExpiryDto.prototype, "expiresAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], AdjustScratchCardExpiryDto.prototype, "validityDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustScratchCardExpiryDto.prototype, "notes", void 0);
class RestoreWalletCreditDto {
    validityDays;
    amount;
    notes;
}
exports.RestoreWalletCreditDto = RestoreWalletCreditDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], RestoreWalletCreditDto.prototype, "validityDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], RestoreWalletCreditDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RestoreWalletCreditDto.prototype, "notes", void 0);
class AdjustWalletCreditExpiryDto {
    expiresAt;
    validityDays;
    notes;
}
exports.AdjustWalletCreditExpiryDto = AdjustWalletCreditExpiryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], AdjustWalletCreditExpiryDto.prototype, "expiresAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], AdjustWalletCreditExpiryDto.prototype, "validityDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustWalletCreditExpiryDto.prototype, "notes", void 0);
class UpdateExpirySettingsDto {
    scratchCardExpiryDays;
    walletAmountExpiryDays;
}
exports.UpdateExpirySettingsDto = UpdateExpirySettingsDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], UpdateExpirySettingsDto.prototype, "scratchCardExpiryDays", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], UpdateExpirySettingsDto.prototype, "walletAmountExpiryDays", void 0);
//# sourceMappingURL=expiry-admin.dto.js.map