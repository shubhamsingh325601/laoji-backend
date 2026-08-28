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
exports.CreateRevenueConfigDto = exports.REVENUE_CONFIG_SCOPES = void 0;
const class_validator_1 = require("class-validator");
exports.REVENUE_CONFIG_SCOPES = ['global', 'category', 'vendor'];
class CreateRevenueConfigDto {
    scope;
    scopeRefId;
    commissionPct;
    deliveryFeeFlat;
    codThreshold;
    notes;
    effectiveFrom;
}
exports.CreateRevenueConfigDto = CreateRevenueConfigDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.REVENUE_CONFIG_SCOPES),
    __metadata("design:type", Object)
], CreateRevenueConfigDto.prototype, "scope", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.scope !== 'global'),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateRevenueConfigDto.prototype, "scopeRefId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1),
    __metadata("design:type", Number)
], CreateRevenueConfigDto.prototype, "commissionPct", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRevenueConfigDto.prototype, "deliveryFeeFlat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRevenueConfigDto.prototype, "codThreshold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRevenueConfigDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateRevenueConfigDto.prototype, "effectiveFrom", void 0);
//# sourceMappingURL=create-revenue-config.dto.js.map