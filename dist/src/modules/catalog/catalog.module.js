"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogModule = void 0;
const common_1 = require("@nestjs/common");
const notification_module_1 = require("../notification/notification.module");
const catalog_service_1 = require("./catalog.service");
const admin_catalog_controller_1 = require("./admin-catalog.controller");
const vendor_catalog_controller_1 = require("./vendor-catalog.controller");
const vendor_menu_controller_1 = require("./vendor-menu.controller");
const public_catalog_controller_1 = require("./public-catalog.controller");
let CatalogModule = class CatalogModule {
};
exports.CatalogModule = CatalogModule;
exports.CatalogModule = CatalogModule = __decorate([
    (0, common_1.Module)({
        imports: [notification_module_1.NotificationModule],
        controllers: [admin_catalog_controller_1.AdminCatalogController, vendor_catalog_controller_1.VendorCatalogController, vendor_menu_controller_1.VendorMenuController, public_catalog_controller_1.PublicCatalogController],
        providers: [catalog_service_1.CatalogService],
        exports: [catalog_service_1.CatalogService],
    })
], CatalogModule);
//# sourceMappingURL=catalog.module.js.map