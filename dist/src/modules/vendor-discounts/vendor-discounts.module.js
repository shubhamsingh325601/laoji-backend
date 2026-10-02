"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorDiscountsModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const database_module_1 = require("../../config/database.module");
const vendor_discounts_service_1 = require("./vendor-discounts.service");
const admin_vendor_discounts_controller_1 = require("./admin-vendor-discounts.controller");
const public_vendor_discounts_controller_1 = require("./public-vendor-discounts.controller");
let VendorDiscountsModule = class VendorDiscountsModule {
};
exports.VendorDiscountsModule = VendorDiscountsModule;
exports.VendorDiscountsModule = VendorDiscountsModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule, jwt_1.JwtModule.register({})],
        controllers: [admin_vendor_discounts_controller_1.AdminVendorDiscountsController, public_vendor_discounts_controller_1.PublicVendorDiscountsController],
        providers: [vendor_discounts_service_1.VendorDiscountsService],
        exports: [vendor_discounts_service_1.VendorDiscountsService],
    })
], VendorDiscountsModule);
//# sourceMappingURL=vendor-discounts.module.js.map