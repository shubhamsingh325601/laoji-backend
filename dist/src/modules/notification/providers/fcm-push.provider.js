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
var FcmPushProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FcmPushProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
let FcmPushProvider = FcmPushProvider_1 = class FcmPushProvider {
    config;
    logger = new common_1.Logger(FcmPushProvider_1.name);
    app = null;
    configured;
    constructor(config) {
        this.config = config;
        const projectId = this.config.get('FIREBASE_PROJECT_ID');
        const clientEmail = this.config.get('FIREBASE_CLIENT_EMAIL');
        const privateKey = this.config.get('FIREBASE_PRIVATE_KEY');
        this.configured = !!(projectId && clientEmail && privateKey);
        if (this.configured) {
            try {
                this.app = (0, app_1.initializeApp)({
                    credential: (0, app_1.cert)({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
                });
                this.logger.log(`Initialized Firebase Admin SDK for project "${projectId}".`);
            }
            catch (err) {
                this.logger.error(`Failed to initialize Firebase Admin SDK: ${err?.message || err}`);
            }
        }
        else {
            this.logger.warn('FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set — FcmPushProvider running in DEV STUB mode.');
        }
    }
    async send(token, message) {
        if (!this.configured || !this.app) {
            this.logger.log(`[DEV STUB] push -> token=${token.slice(0, 12)}... title="${message.title}" body="${message.body}"`);
            return { ok: true, stubbed: true };
        }
        try {
            const payload = {
                token,
                notification: {
                    title: message.title,
                    body: message.body,
                    ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
                },
                android: {
                    notification: {
                        sound: 'default',
                        priority: 'high',
                        ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            'mutable-content': 1,
                        },
                    },
                    fcmOptions: {
                        ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
                    },
                },
                data: message.data || {},
            };
            await (0, messaging_1.getMessaging)(this.app).send(payload);
            return { ok: true, stubbed: false };
        }
        catch (e) {
            const code = e?.code || e?.errorInfo?.code;
            if (code === 'messaging/invalid-registration-token' ||
                code === 'messaging/registration-token-not-registered') {
                this.logger.warn(`Stale or invalid FCM token (${code}): ${token.slice(0, 12)}...`);
            }
            else {
                this.logger.warn(`FCM send failed: ${e instanceof Error ? e.message : e}`);
            }
            return { ok: false, stubbed: false, error: e?.message };
        }
    }
};
exports.FcmPushProvider = FcmPushProvider;
exports.FcmPushProvider = FcmPushProvider = FcmPushProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FcmPushProvider);
//# sourceMappingURL=fcm-push.provider.js.map