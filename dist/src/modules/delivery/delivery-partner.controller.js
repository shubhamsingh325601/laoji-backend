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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryPartnerController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const delivery_service_1 = require("./delivery.service");
const delivery_partner_dto_1 = require("./dto/delivery-partner.dto");
let DeliveryPartnerController = class DeliveryPartnerController {
    delivery;
    constructor(delivery) {
        this.delivery = delivery;
    }
    upsertProfile(user, dto) {
        return this.delivery.upsertProfile(user.sub, dto.vehicleType);
    }
    myProfile(user) {
        return this.delivery.getEnrichedProfile(user.sub);
    }
    setOnline(user, dto) {
        return this.delivery.setOnline(user.sub, dto.isOnline);
    }
    updateLocation(user, dto) {
        return this.delivery.updateLocation(user.sub, dto.lat, dto.lng);
    }
};
exports.DeliveryPartnerController = DeliveryPartnerController;
__decorate([
    (0, common_1.Post)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, delivery_partner_dto_1.UpsertDeliveryPartnerDto]),
    __metadata("design:returntype", void 0)
], DeliveryPartnerController.prototype, "upsertProfile", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DeliveryPartnerController.prototype, "myProfile", null);
__decorate([
    (0, common_1.Patch)('me/online'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, delivery_partner_dto_1.SetOnlineDto]),
    __metadata("design:returntype", void 0)
], DeliveryPartnerController.prototype, "setOnline", null);
__decorate([
    (0, common_1.Patch)('me/location'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, delivery_partner_dto_1.UpdateLocationDto]),
    __metadata("design:returntype", void 0)
], DeliveryPartnerController.prototype, "updateLocation", null);
exports.DeliveryPartnerController = DeliveryPartnerController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('delivery_partner'),
    (0, common_1.Controller)('delivery-partners'),
    __metadata("design:paramtypes", [delivery_service_1.DeliveryService])
], DeliveryPartnerController);
//# sourceMappingURL=delivery-partner.controller.js.map