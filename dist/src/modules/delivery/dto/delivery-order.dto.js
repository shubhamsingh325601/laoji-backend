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
exports.VerifyDeliveryDto = exports.AdvanceDeliveryStatusDto = exports.DELIVERY_FORWARD_STATUSES = void 0;
const class_validator_1 = require("class-validator");
exports.DELIVERY_FORWARD_STATUSES = ['picked_up', 'out_for_delivery'];
class AdvanceDeliveryStatusDto {
    status;
}
exports.AdvanceDeliveryStatusDto = AdvanceDeliveryStatusDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.DELIVERY_FORWARD_STATUSES),
    __metadata("design:type", Object)
], AdvanceDeliveryStatusDto.prototype, "status", void 0);
class VerifyDeliveryDto {
    otp;
}
exports.VerifyDeliveryDto = VerifyDeliveryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(4, 6),
    __metadata("design:type", String)
], VerifyDeliveryDto.prototype, "otp", void 0);
//# sourceMappingURL=delivery-order.dto.js.map