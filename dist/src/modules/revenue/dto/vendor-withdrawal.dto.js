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
exports.RejectWithdrawalDto = exports.ApproveWithdrawalDto = exports.RequestVendorWithdrawalDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class RequestVendorWithdrawalDto {
    amount;
}
exports.RequestVendorWithdrawalDto = RequestVendorWithdrawalDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], RequestVendorWithdrawalDto.prototype, "amount", void 0);
class ApproveWithdrawalDto {
    payoutReference;
}
exports.ApproveWithdrawalDto = ApproveWithdrawalDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ApproveWithdrawalDto.prototype, "payoutReference", void 0);
class RejectWithdrawalDto {
    reason;
}
exports.RejectWithdrawalDto = RejectWithdrawalDto;
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3, { message: 'Please give the vendor a reason for rejecting this request' }),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RejectWithdrawalDto.prototype, "reason", void 0);
//# sourceMappingURL=vendor-withdrawal.dto.js.map