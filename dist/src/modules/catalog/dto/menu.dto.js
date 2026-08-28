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
exports.UpdateMenuItemDto = exports.CreateMenuItemDto = exports.MenuItemVariantInput = exports.MenuItemAddonInput = exports.UpdateMenuCategoryDto = exports.CreateMenuCategoryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class CreateMenuCategoryDto {
    name;
    sortOrder;
}
exports.CreateMenuCategoryDto = CreateMenuCategoryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 150),
    __metadata("design:type", String)
], CreateMenuCategoryDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateMenuCategoryDto.prototype, "sortOrder", void 0);
class UpdateMenuCategoryDto {
    name;
    sortOrder;
}
exports.UpdateMenuCategoryDto = UpdateMenuCategoryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 150),
    __metadata("design:type", String)
], UpdateMenuCategoryDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateMenuCategoryDto.prototype, "sortOrder", void 0);
class MenuItemAddonInput {
    name;
    price;
    isRequired;
}
exports.MenuItemAddonInput = MenuItemAddonInput;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 150),
    __metadata("design:type", String)
], MenuItemAddonInput.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MenuItemAddonInput.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MenuItemAddonInput.prototype, "isRequired", void 0);
class MenuItemVariantInput {
    name;
    priceDelta;
    isDefault;
}
exports.MenuItemVariantInput = MenuItemVariantInput;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 150),
    __metadata("design:type", String)
], MenuItemVariantInput.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MenuItemVariantInput.prototype, "priceDelta", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MenuItemVariantInput.prototype, "isDefault", void 0);
class CreateMenuItemDto {
    menuCategoryId;
    name;
    description;
    price;
    imageUrl;
    isVeg;
    addons;
    variants;
}
exports.CreateMenuItemDto = CreateMenuItemDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateMenuItemDto.prototype, "menuCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], CreateMenuItemDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMenuItemDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMenuItemDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMenuItemDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateMenuItemDto.prototype, "isVeg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MenuItemAddonInput),
    __metadata("design:type", Array)
], CreateMenuItemDto.prototype, "addons", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MenuItemVariantInput),
    __metadata("design:type", Array)
], CreateMenuItemDto.prototype, "variants", void 0);
class UpdateMenuItemDto {
    menuCategoryId;
    name;
    description;
    price;
    imageUrl;
    isVeg;
    isAvailable;
    addons;
    variants;
}
exports.UpdateMenuItemDto = UpdateMenuItemDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateMenuItemDto.prototype, "menuCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], UpdateMenuItemDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMenuItemDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateMenuItemDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMenuItemDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateMenuItemDto.prototype, "isVeg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateMenuItemDto.prototype, "isAvailable", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MenuItemAddonInput),
    __metadata("design:type", Array)
], UpdateMenuItemDto.prototype, "addons", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MenuItemVariantInput),
    __metadata("design:type", Array)
], UpdateMenuItemDto.prototype, "variants", void 0);
//# sourceMappingURL=menu.dto.js.map