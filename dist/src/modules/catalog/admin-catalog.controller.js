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
exports.AdminCatalogController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const catalog_service_1 = require("./catalog.service");
const category_dto_1 = require("./dto/category.dto");
const product_dto_1 = require("./dto/product.dto");
const product_suggestion_dto_1 = require("./dto/product-suggestion.dto");
const admin_vendor_dto_1 = require("./dto/admin-vendor.dto");
let AdminCatalogController = class AdminCatalogController {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    listCategories() {
        return this.catalog.listCategoriesTree();
    }
    createCategory(dto) {
        return this.catalog.createCategory(dto);
    }
    updateCategory(id, dto) {
        return this.catalog.updateCategory(id, dto);
    }
    deleteCategory(id) {
        return this.catalog.deleteCategory(id);
    }
    listProducts() {
        return this.catalog.listProducts();
    }
    createProduct(dto) {
        return this.catalog.createProduct(dto);
    }
    updateProduct(id, dto) {
        return this.catalog.updateProduct(id, dto);
    }
    deleteProduct(id) {
        return this.catalog.deleteProduct(id);
    }
    listVendors() {
        return this.catalog.listVendorsAdmin();
    }
    getVendor(id) {
        return this.catalog.getAdminVendor(id);
    }
    createVendor(dto) {
        return this.catalog.createAdminVendor(dto);
    }
    updateVendor(id, dto) {
        return this.catalog.updateAdminVendor(id, dto);
    }
    deleteVendor(id) {
        return this.catalog.deleteAdminVendor(id);
    }
    listRestaurants() {
        return this.catalog.listRestaurantsBasic();
    }
    listMenuItems() {
        return this.catalog.listMenuItemsBasic();
    }
    listProductSuggestions(status) {
        return this.catalog.listProductSuggestions(status);
    }
    approveProductSuggestion(user, id) {
        return this.catalog.approveProductSuggestion(user.sub, id);
    }
    rejectProductSuggestion(user, id, dto) {
        return this.catalog.rejectProductSuggestion(user.sub, id, dto.reason);
    }
};
exports.AdminCatalogController = AdminCatalogController;
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "listCategories", null);
__decorate([
    (0, common_1.Post)('categories'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [category_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Patch)('categories/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, category_dto_1.UpdateCategoryDto]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "updateCategory", null);
__decorate([
    (0, common_1.Delete)('categories/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "deleteCategory", null);
__decorate([
    (0, common_1.Get)('products'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "listProducts", null);
__decorate([
    (0, common_1.Post)('products'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [product_dto_1.CreateProductDto]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Delete)('products/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "deleteProduct", null);
__decorate([
    (0, common_1.Get)('vendors'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "listVendors", null);
__decorate([
    (0, common_1.Get)('vendors/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "getVendor", null);
__decorate([
    (0, common_1.Post)('vendors'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_vendor_dto_1.CreateAdminVendorDto]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "createVendor", null);
__decorate([
    (0, common_1.Patch)('vendors/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_vendor_dto_1.UpdateAdminVendorDto]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "updateVendor", null);
__decorate([
    (0, common_1.Delete)('vendors/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "deleteVendor", null);
__decorate([
    (0, common_1.Get)('restaurants'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "listRestaurants", null);
__decorate([
    (0, common_1.Get)('menu-items'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "listMenuItems", null);
__decorate([
    (0, common_1.Get)('product-suggestions'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "listProductSuggestions", null);
__decorate([
    (0, common_1.Post)('product-suggestions/:id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "approveProductSuggestion", null);
__decorate([
    (0, common_1.Post)('product-suggestions/:id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, product_suggestion_dto_1.RejectProductSuggestionDto]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "rejectProductSuggestion", null);
exports.AdminCatalogController = AdminCatalogController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin'),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService])
], AdminCatalogController);
//# sourceMappingURL=admin-catalog.controller.js.map