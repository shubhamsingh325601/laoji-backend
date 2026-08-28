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
exports.VendorMenuController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const catalog_service_1 = require("./catalog.service");
const restaurant_dto_1 = require("./dto/restaurant.dto");
const menu_dto_1 = require("./dto/menu.dto");
let VendorMenuController = class VendorMenuController {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    async myRestaurant(user) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.getOrCreateRestaurant(vendor.id);
    }
    async updateRestaurant(user, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.updateRestaurant(vendor.id, dto);
    }
    async listMenuCategories(user) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.listMenuCategories(vendor.id);
    }
    async createMenuCategory(user, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.createMenuCategory(vendor.id, dto);
    }
    async updateMenuCategory(user, id, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.updateMenuCategory(vendor.id, id, dto);
    }
    async deleteMenuCategory(user, id) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.deleteMenuCategory(vendor.id, id);
    }
    async listMenuItems(user, categoryId) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.listMenuItems(vendor.id, categoryId);
    }
    async createMenuItem(user, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.createMenuItem(vendor.id, dto);
    }
    async updateMenuItem(user, id, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.updateMenuItem(vendor.id, id, dto);
    }
    async deleteMenuItem(user, id) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.deleteMenuItem(vendor.id, id);
    }
};
exports.VendorMenuController = VendorMenuController;
__decorate([
    (0, common_1.Get)('restaurant'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorMenuController.prototype, "myRestaurant", null);
__decorate([
    (0, common_1.Patch)('restaurant'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, restaurant_dto_1.UpdateRestaurantDto]),
    __metadata("design:returntype", Promise)
], VendorMenuController.prototype, "updateRestaurant", null);
__decorate([
    (0, common_1.Get)('menu/categories'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorMenuController.prototype, "listMenuCategories", null);
__decorate([
    (0, common_1.Post)('menu/categories'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, menu_dto_1.CreateMenuCategoryDto]),
    __metadata("design:returntype", Promise)
], VendorMenuController.prototype, "createMenuCategory", null);
__decorate([
    (0, common_1.Patch)('menu/categories/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, menu_dto_1.UpdateMenuCategoryDto]),
    __metadata("design:returntype", Promise)
], VendorMenuController.prototype, "updateMenuCategory", null);
__decorate([
    (0, common_1.Delete)('menu/categories/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorMenuController.prototype, "deleteMenuCategory", null);
__decorate([
    (0, common_1.Get)('menu/items'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorMenuController.prototype, "listMenuItems", null);
__decorate([
    (0, common_1.Post)('menu/items'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, menu_dto_1.CreateMenuItemDto]),
    __metadata("design:returntype", Promise)
], VendorMenuController.prototype, "createMenuItem", null);
__decorate([
    (0, common_1.Patch)('menu/items/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, menu_dto_1.UpdateMenuItemDto]),
    __metadata("design:returntype", Promise)
], VendorMenuController.prototype, "updateMenuItem", null);
__decorate([
    (0, common_1.Delete)('menu/items/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorMenuController.prototype, "deleteMenuItem", null);
exports.VendorMenuController = VendorMenuController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('vendor'),
    (0, common_1.Controller)('vendor'),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService])
], VendorMenuController);
//# sourceMappingURL=vendor-menu.controller.js.map