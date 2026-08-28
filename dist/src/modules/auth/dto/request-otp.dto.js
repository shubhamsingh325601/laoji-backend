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
exports.RequestOtpDto = void 0;
const class_validator_1 = require("class-validator");
const auth_types_1 = require("../auth.types");
class RequestOtpDto {
    phone;
    role;
}
exports.RequestOtpDto = RequestOtpDto;
__decorate([
    (0, class_validator_1.Matches)(/^[0-9]{10}$/, { message: 'phone must be a 10-digit number' }),
    __metadata("design:type", String)
], RequestOtpDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(auth_types_1.OTP_ROLES),
    __metadata("design:type", String)
], RequestOtpDto.prototype, "role", void 0);
//# sourceMappingURL=request-otp.dto.js.map