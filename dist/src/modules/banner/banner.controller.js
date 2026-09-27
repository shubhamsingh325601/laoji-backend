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
exports.AdminBannerController = exports.PublicBannerController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const banner_service_1 = require("./banner.service");
const banner_dto_1 = require("./dto/banner.dto");
let PublicBannerController = class PublicBannerController {
    banners;
    constructor(banners) {
        this.banners = banners;
    }
    list(placement = 'home') {
        if (!banner_dto_1.BANNER_PLACEMENTS.includes(placement)) {
            throw new common_1.BadRequestException(`placement must be one of: ${banner_dto_1.BANNER_PLACEMENTS.join(', ')}`);
        }
        return this.banners.listLive(placement);
    }
};
exports.PublicBannerController = PublicBannerController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('placement')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PublicBannerController.prototype, "list", null);
exports.PublicBannerController = PublicBannerController = __decorate([
    (0, common_1.Controller)('banners'),
    __metadata("design:paramtypes", [banner_service_1.BannerService])
], PublicBannerController);
let AdminBannerController = class AdminBannerController {
    banners;
    constructor(banners) {
        this.banners = banners;
    }
    listAll() {
        return this.banners.listAllForAdmin();
    }
    create(dto) {
        return this.banners.create(dto);
    }
    update(id, dto) {
        return this.banners.update(id, dto);
    }
    delete(id) {
        return this.banners.delete(id);
    }
};
exports.AdminBannerController = AdminBannerController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminBannerController.prototype, "listAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [banner_dto_1.CreateBannerDto]),
    __metadata("design:returntype", void 0)
], AdminBannerController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, banner_dto_1.UpdateBannerDto]),
    __metadata("design:returntype", void 0)
], AdminBannerController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminBannerController.prototype, "delete", null);
exports.AdminBannerController = AdminBannerController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin/banners'),
    __metadata("design:paramtypes", [banner_service_1.BannerService])
], AdminBannerController);
//# sourceMappingURL=banner.controller.js.map