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
var ResendEmailProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendEmailProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const resend_1 = require("resend");
let ResendEmailProvider = ResendEmailProvider_1 = class ResendEmailProvider {
    config;
    logger = new common_1.Logger(ResendEmailProvider_1.name);
    client;
    fromAddress = 'Laoji <notifications@laoji.app>';
    constructor(config) {
        this.config = config;
        const apiKey = this.config.get('RESEND_API_KEY');
        this.client = apiKey ? new resend_1.Resend(apiKey) : null;
    }
    async send(to, message) {
        if (!this.client) {
            this.logger.log(`[DEV STUB] email -> to=${to} subject="${message.subject}"\n${message.html}`);
            return { ok: true, stubbed: true };
        }
        try {
            const { error } = await this.client.emails.send({
                from: this.fromAddress,
                to,
                subject: message.subject,
                html: message.html,
            });
            if (error) {
                this.logger.warn(`Resend send failed: ${error.message}`);
                return { ok: false, stubbed: false };
            }
            return { ok: true, stubbed: false };
        }
        catch (e) {
            this.logger.warn(`Resend send failed: ${e instanceof Error ? e.message : e}`);
            return { ok: false, stubbed: false };
        }
    }
};
exports.ResendEmailProvider = ResendEmailProvider;
exports.ResendEmailProvider = ResendEmailProvider = ResendEmailProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ResendEmailProvider);
//# sourceMappingURL=resend-email.provider.js.map