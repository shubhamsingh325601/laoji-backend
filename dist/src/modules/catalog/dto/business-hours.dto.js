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
exports.UpdateBusinessHoursDto = exports.BusinessHoursDayDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
class BusinessHoursDayDto {
    day;
    isOpen;
    openTime;
    closeTime;
}
exports.BusinessHoursDayDto = BusinessHoursDayDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(6),
    __metadata("design:type", Number)
], BusinessHoursDayDto.prototype, "day", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BusinessHoursDayDto.prototype, "isOpen", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(TIME_RE, { message: 'openTime must be HH:mm' }),
    __metadata("design:type", String)
], BusinessHoursDayDto.prototype, "openTime", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(TIME_RE, { message: 'closeTime must be HH:mm' }),
    __metadata("design:type", String)
], BusinessHoursDayDto.prototype, "closeTime", void 0);
class UpdateBusinessHoursDto {
    isOpen;
    schedule;
}
exports.UpdateBusinessHoursDto = UpdateBusinessHoursDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateBusinessHoursDto.prototype, "isOpen", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(7),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BusinessHoursDayDto),
    __metadata("design:type", Array)
], UpdateBusinessHoursDto.prototype, "schedule", void 0);
//# sourceMappingURL=business-hours.dto.js.map