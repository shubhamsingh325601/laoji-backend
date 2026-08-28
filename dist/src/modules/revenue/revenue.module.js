"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueModule = void 0;
const common_1 = require("@nestjs/common");
const revenue_config_service_1 = require("./revenue-config.service");
const settlement_service_1 = require("./settlement.service");
const admin_revenue_controller_1 = require("./admin-revenue.controller");
const vendor_settlement_controller_1 = require("./vendor-settlement.controller");
const partner_settlement_controller_1 = require("./partner-settlement.controller");
let RevenueModule = class RevenueModule {
};
exports.RevenueModule = RevenueModule;
exports.RevenueModule = RevenueModule = __decorate([
    (0, common_1.Module)({
        controllers: [admin_revenue_controller_1.AdminRevenueController, vendor_settlement_controller_1.VendorSettlementController, partner_settlement_controller_1.PartnerSettlementController],
        providers: [revenue_config_service_1.RevenueConfigService, settlement_service_1.SettlementService],
        exports: [revenue_config_service_1.RevenueConfigService, settlement_service_1.SettlementService],
    })
], RevenueModule);
//# sourceMappingURL=revenue.module.js.map