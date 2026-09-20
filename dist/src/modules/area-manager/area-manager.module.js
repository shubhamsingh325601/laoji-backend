"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AreaManagerModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../config/database.module");
const notification_module_1 = require("../notification/notification.module");
const area_manager_service_1 = require("./area-manager.service");
const admin_area_manager_controller_1 = require("./admin-area-manager.controller");
let AreaManagerModule = class AreaManagerModule {
};
exports.AreaManagerModule = AreaManagerModule;
exports.AreaManagerModule = AreaManagerModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule, notification_module_1.NotificationModule],
        controllers: [admin_area_manager_controller_1.AdminAreaManagerController],
        providers: [area_manager_service_1.AreaManagerService],
        exports: [area_manager_service_1.AreaManagerService],
    })
], AreaManagerModule);
//# sourceMappingURL=area-manager.module.js.map