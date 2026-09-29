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
exports.UpdateMealTimingsDto = exports.MealTimingDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const meal_slots_1 = require("../meal-slots");
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
class MealTimingDto {
    slot;
    start;
    end;
}
exports.MealTimingDto = MealTimingDto;
__decorate([
    (0, class_validator_1.IsIn)(meal_slots_1.MEAL_SLOTS),
    __metadata("design:type", String)
], MealTimingDto.prototype, "slot", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(TIME_RE, { message: 'start must be HH:mm' }),
    __metadata("design:type", String)
], MealTimingDto.prototype, "start", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(TIME_RE, { message: 'end must be HH:mm' }),
    __metadata("design:type", String)
], MealTimingDto.prototype, "end", void 0);
class UpdateMealTimingsDto {
    timings;
}
exports.UpdateMealTimingsDto = UpdateMealTimingsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(meal_slots_1.MEAL_SLOTS.length),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MealTimingDto),
    __metadata("design:type", Array)
], UpdateMealTimingsDto.prototype, "timings", void 0);
//# sourceMappingURL=meal-timings.dto.js.map