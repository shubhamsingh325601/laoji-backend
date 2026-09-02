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
exports.PublicCatalogController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const catalog_service_1 = require("./catalog.service");
function parseCoord(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!lat || !lng || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        throw new common_1.BadRequestException('lat and lng query params are required');
    }
    return { lat: latNum, lng: lngNum };
}
let PublicCatalogController = class PublicCatalogController {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    categories() {
        return this.catalog.listCategoriesFlat();
    }
    products(lat, lng, categoryId) {
        const { lat: latNum, lng: lngNum } = parseCoord(lat, lng);
        return this.catalog.publicListProducts(latNum, lngNum, categoryId);
    }
    product(id, lat, lng) {
        const { lat: latNum, lng: lngNum } = parseCoord(lat, lng);
        return this.catalog.publicGetProduct(id, latNum, lngNum);
    }
    restaurants(lat, lng) {
        const { lat: latNum, lng: lngNum } = parseCoord(lat, lng);
        return this.catalog.publicListRestaurants(latNum, lngNum);
    }
    restaurant(id) {
        return this.catalog.publicGetRestaurant(id);
    }
    search(lat, lng, q) {
        const { lat: latNum, lng: lngNum } = parseCoord(lat, lng);
        return this.catalog.publicSearch(latNum, lngNum, q ?? '');
    }
};
exports.PublicCatalogController = PublicCatalogController;
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicCatalogController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)('products'),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __param(2, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], PublicCatalogController.prototype, "products", null);
__decorate([
    (0, common_1.Get)('products/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('lat')),
    __param(2, (0, common_1.Query)('lng')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], PublicCatalogController.prototype, "product", null);
__decorate([
    (0, common_1.Get)('restaurants'),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PublicCatalogController.prototype, "restaurants", null);
__decorate([
    (0, common_1.Get)('restaurants/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicCatalogController.prototype, "restaurant", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], PublicCatalogController.prototype, "search", null);
exports.PublicCatalogController = PublicCatalogController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('catalog'),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService])
], PublicCatalogController);
//# sourceMappingURL=public-catalog.controller.js.map