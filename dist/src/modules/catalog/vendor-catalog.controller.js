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
exports.VendorCatalogController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const catalog_service_1 = require("./catalog.service");
const vendor_profile_dto_1 = require("./dto/vendor-profile.dto");
const business_hours_dto_1 = require("./dto/business-hours.dto");
const vendor_product_dto_1 = require("./dto/vendor-product.dto");
const category_dto_1 = require("./dto/category.dto");
const product_suggestion_dto_1 = require("./dto/product-suggestion.dto");
const category_suggestion_dto_1 = require("./dto/category-suggestion.dto");
const create_grocery_product_dto_1 = require("./dto/create-grocery-product.dto");
const product_forms_1 = require("./product-forms");
let VendorCatalogController = class VendorCatalogController {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    upsertProfile(user, dto) {
        return this.catalog.upsertVendorProfile(user.sub, dto);
    }
    async myProfile(user) {
        return this.catalog.getVendorByUserId(user.sub);
    }
    async updateBusinessHours(user, dto) {
        return this.catalog.updateBusinessHours(user.sub, dto);
    }
    async updateLocation(user, dto) {
        return this.catalog.updateVendorLocation(user.sub, dto);
    }
    async deleteAccount(user) {
        return this.catalog.deleteVendorAccount(user.sub);
    }
    async deleteAccountAlt(user) {
        return this.catalog.deleteVendorAccount(user.sub);
    }
    async myCategories(user) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.listVendorCategories(vendor);
    }
    async createCategory(user, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.createVendorCategory(vendor, dto);
    }
    async updateVendorCategory(user, id, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.renameVendorCategory(vendor, id, dto.name);
    }
    async deleteVendorCategory(user, id) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.deleteVendorCategory(vendor, id);
    }
    async productForm(user) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return (0, product_forms_1.productFormFor)(vendor.businessType);
    }
    async browseMasterCatalog(user, categoryId) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.listVendorCatalogProducts(vendor, categoryId);
    }
    async myListings(user) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.listVendorProducts(vendor.id);
    }
    async upsertListing(user, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.upsertVendorProduct(vendor, dto);
    }
    async createNewProduct(user, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.createVendorProduct(vendor, dto);
    }
    async updateListing(user, id, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.updateVendorProduct(vendor, id, dto);
    }
    async restockListing(user, id, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.restockVendorProduct(vendor.id, id, dto.qty);
    }
    async deleteListing(user, id) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.deleteVendorProduct(vendor.id, id);
    }
    async listCategories(user) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.listVendorCategories(vendor);
    }
    async createCategoryFlat(user, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.createVendorCategory(vendor, { name: dto.name });
    }
    async updateCategory(user, id, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        if (!dto.name)
            throw new common_1.BadRequestException('Category name is required');
        return this.catalog.renameVendorCategory(vendor, id, dto.name);
    }
    async deleteCategory(user, id) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.deleteVendorCategory(vendor, id);
    }
    async createCustomProduct(user, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.createVendorCustomProduct(vendor, dto);
    }
    async updateCustomProduct(user, productId, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.updateVendorCustomProduct(vendor, productId, dto);
    }
    async deleteCustomProduct(user, productId) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.deleteVendorCustomProduct(vendor.id, productId);
    }
    async submitSuggestion(user, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.createProductSuggestion(vendor, dto);
    }
    async myProductSuggestions(user) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.listMyProductSuggestions(vendor.id);
    }
    async submitCategorySuggestion(user, dto) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.createCategorySuggestion(vendor, dto);
    }
    async myCategorySuggestions(user) {
        const vendor = await this.catalog.requireVendor(user.sub);
        return this.catalog.listMyCategorySuggestions(vendor.id);
    }
};
exports.VendorCatalogController = VendorCatalogController;
__decorate([
    (0, common_1.Post)('vendors/me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, vendor_profile_dto_1.UpsertVendorProfileDto]),
    __metadata("design:returntype", void 0)
], VendorCatalogController.prototype, "upsertProfile", null);
__decorate([
    (0, common_1.Get)('vendors/me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "myProfile", null);
__decorate([
    (0, common_1.Patch)('vendors/me/business-hours'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, business_hours_dto_1.UpdateBusinessHoursDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "updateBusinessHours", null);
__decorate([
    (0, common_1.Patch)('vendors/me/location'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, vendor_profile_dto_1.UpdateVendorLocationDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.Delete)('vendors/me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "deleteAccount", null);
__decorate([
    (0, common_1.Delete)('vendor/me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "deleteAccountAlt", null);
__decorate([
    (0, common_1.Get)('vendor/catalog/categories'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "myCategories", null);
__decorate([
    (0, common_1.Post)('vendor/catalog/categories'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, category_dto_1.CreateVendorCategoryDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Patch)('vendor/catalog/categories/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, category_dto_1.UpdateVendorCategoryDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "updateVendorCategory", null);
__decorate([
    (0, common_1.Delete)('vendor/catalog/categories/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "deleteVendorCategory", null);
__decorate([
    (0, common_1.Get)('vendor/catalog/product-form'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "productForm", null);
__decorate([
    (0, common_1.Get)('vendor/catalog/products'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "browseMasterCatalog", null);
__decorate([
    (0, common_1.Get)('vendor/products'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "myListings", null);
__decorate([
    (0, common_1.Post)('vendor/products'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, vendor_product_dto_1.UpsertVendorProductDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "upsertListing", null);
__decorate([
    (0, common_1.Post)('vendor/products/new'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_grocery_product_dto_1.CreateGroceryProductDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "createNewProduct", null);
__decorate([
    (0, common_1.Patch)('vendor/products/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, vendor_product_dto_1.UpdateVendorProductDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "updateListing", null);
__decorate([
    (0, common_1.Post)('vendor/products/:id/restock'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, vendor_product_dto_1.RestockVendorProductDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "restockListing", null);
__decorate([
    (0, common_1.Delete)('vendor/products/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "deleteListing", null);
__decorate([
    (0, common_1.Get)('vendor/categories'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "listCategories", null);
__decorate([
    (0, common_1.Post)('vendor/categories'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, category_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "createCategoryFlat", null);
__decorate([
    (0, common_1.Patch)('vendor/categories/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, category_dto_1.UpdateCategoryDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "updateCategory", null);
__decorate([
    (0, common_1.Delete)('vendor/categories/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "deleteCategory", null);
__decorate([
    (0, common_1.Post)('vendor/products/custom'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, vendor_product_dto_1.CreateVendorCustomProductDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "createCustomProduct", null);
__decorate([
    (0, common_1.Patch)('vendor/products/custom/:productId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('productId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, vendor_product_dto_1.UpdateVendorCustomProductDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "updateCustomProduct", null);
__decorate([
    (0, common_1.Delete)('vendor/products/custom/:productId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "deleteCustomProduct", null);
__decorate([
    (0, throttler_1.Throttle)({ productSuggestion: { limit: 5, ttl: 60_000 } }),
    (0, common_1.Post)('vendor/product-suggestions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, product_suggestion_dto_1.CreateProductSuggestionDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "submitSuggestion", null);
__decorate([
    (0, common_1.Get)('vendor/product-suggestions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "myProductSuggestions", null);
__decorate([
    (0, throttler_1.Throttle)({ productSuggestion: { limit: 5, ttl: 60_000 } }),
    (0, common_1.Post)('vendor/category-suggestions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, category_suggestion_dto_1.CreateCategorySuggestionDto]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "submitCategorySuggestion", null);
__decorate([
    (0, common_1.Get)('vendor/category-suggestions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorCatalogController.prototype, "myCategorySuggestions", null);
exports.VendorCatalogController = VendorCatalogController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('vendor'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService])
], VendorCatalogController);
//# sourceMappingURL=vendor-catalog.controller.js.map