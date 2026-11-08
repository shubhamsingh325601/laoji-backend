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
exports.UpdateHomeTabsDto = exports.HomeTabDto = exports.HOME_TAB_KEYS = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.HOME_TAB_KEYS = ['grocery', 'veg', 'non_veg'];
class HomeTabDto {
    key;
    label;
    isActive;
}
exports.HomeTabDto = HomeTabDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.HOME_TAB_KEYS),
    __metadata("design:type", String)
], HomeTabDto.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], HomeTabDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], HomeTabDto.prototype, "isActive", void 0);
class UpdateHomeTabsDto {
    tabs;
}
exports.UpdateHomeTabsDto = UpdateHomeTabsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(exports.HOME_TAB_KEYS.length),
    (0, class_validator_1.ArrayMaxSize)(exports.HOME_TAB_KEYS.length),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => HomeTabDto),
    __metadata("design:type", Array)
], UpdateHomeTabsDto.prototype, "tabs", void 0);
//# sourceMappingURL=home-tab.dto.js.map