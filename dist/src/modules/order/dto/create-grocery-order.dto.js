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
exports.CreateGroceryOrderDto = exports.GroceryOrderLineDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class GroceryOrderLineDto {
    productId;
    qty;
}
exports.GroceryOrderLineDto = GroceryOrderLineDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GroceryOrderLineDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GroceryOrderLineDto.prototype, "qty", void 0);
class CreateGroceryOrderDto {
    items;
    deliveryAddressId;
    instructions;
}
exports.CreateGroceryOrderDto = CreateGroceryOrderDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => GroceryOrderLineDto),
    __metadata("design:type", Array)
], CreateGroceryOrderDto.prototype, "items", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateGroceryOrderDto.prototype, "deliveryAddressId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateGroceryOrderDto.prototype, "instructions", void 0);
//# sourceMappingURL=create-grocery-order.dto.js.map