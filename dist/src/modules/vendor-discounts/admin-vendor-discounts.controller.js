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
exports.AdminVendorDiscountsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const vendor_discounts_service_1 = require("./vendor-discounts.service");
const create_vendor_discount_dto_1 = require("./dto/create-vendor-discount.dto");
const update_vendor_discount_dto_1 = require("./dto/update-vendor-discount.dto");
let AdminVendorDiscountsController = class AdminVendorDiscountsController {
    discountsService;
    constructor(discountsService) {
        this.discountsService = discountsService;
    }
    listForVendor(vendorId) {
        return this.discountsService.listByVendor(vendorId);
    }
    create(vendorId, dto) {
        return this.discountsService.create(vendorId, dto);
    }
    update(id, dto) {
        return this.discountsService.update(id, dto);
    }
    toggleActive(id) {
        return this.discountsService.toggleActive(id);
    }
    delete(id) {
        return this.discountsService.delete(id);
    }
};
exports.AdminVendorDiscountsController = AdminVendorDiscountsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('vendorId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminVendorDiscountsController.prototype, "listForVendor", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Param)('vendorId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_vendor_discount_dto_1.CreateVendorDiscountDto]),
    __metadata("design:returntype", void 0)
], AdminVendorDiscountsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_vendor_discount_dto_1.UpdateVendorDiscountDto]),
    __metadata("design:returntype", void 0)
], AdminVendorDiscountsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminVendorDiscountsController.prototype, "toggleActive", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminVendorDiscountsController.prototype, "delete", null);
exports.AdminVendorDiscountsController = AdminVendorDiscountsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin/vendors/:vendorId/discounts'),
    __metadata("design:paramtypes", [vendor_discounts_service_1.VendorDiscountsService])
], AdminVendorDiscountsController);
//# sourceMappingURL=admin-vendor-discounts.controller.js.map