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
exports.AdminHomeTabController = exports.PublicHomeTabController = void 0;
const common_1 = require("@nestjs/common");
const response_cache_interceptor_1 = require("../../common/cache/response-cache.interceptor");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const home_tab_service_1 = require("./home-tab.service");
const home_tab_dto_1 = require("./dto/home-tab.dto");
let PublicHomeTabController = class PublicHomeTabController {
    homeTabs;
    constructor(homeTabs) {
        this.homeTabs = homeTabs;
    }
    list() {
        return this.homeTabs.listLive();
    }
};
exports.PublicHomeTabController = PublicHomeTabController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicHomeTabController.prototype, "list", null);
exports.PublicHomeTabController = PublicHomeTabController = __decorate([
    (0, common_1.UseInterceptors)(response_cache_interceptor_1.ResponseCacheInterceptor),
    (0, common_1.Controller)('home-tabs'),
    __metadata("design:paramtypes", [home_tab_service_1.HomeTabService])
], PublicHomeTabController);
let AdminHomeTabController = class AdminHomeTabController {
    homeTabs;
    constructor(homeTabs) {
        this.homeTabs = homeTabs;
    }
    list() {
        return this.homeTabs.listAll();
    }
    update(dto, admin) {
        return this.homeTabs.update(dto.tabs, admin?.sub);
    }
};
exports.AdminHomeTabController = AdminHomeTabController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminHomeTabController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [home_tab_dto_1.UpdateHomeTabsDto, Object]),
    __metadata("design:returntype", void 0)
], AdminHomeTabController.prototype, "update", null);
exports.AdminHomeTabController = AdminHomeTabController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin/home-tabs'),
    __metadata("design:paramtypes", [home_tab_service_1.HomeTabService])
], AdminHomeTabController);
//# sourceMappingURL=home-tab.controller.js.map