"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = exports.DRIZZLE = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = __importStar(require("../../drizzle/schema"));
exports.DRIZZLE = Symbol('DRIZZLE');
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: exports.DRIZZLE,
                inject: [config_1.ConfigService],
                useFactory: async (config) => {
                    const pool = new pg_1.Pool({ connectionString: config.get('DATABASE_URL') });
                    try {
                        await pool.query(`
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "vendor_id" uuid;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "beneficiary_user_id" uuid;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "show_in_app" boolean NOT NULL DEFAULT true;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "affiliate_commission_type" varchar(20);
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "affiliate_commission_value" double precision;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "max_uses_per_user" integer;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "max_total_uses" integer;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "total_redemptions" integer NOT NULL DEFAULT 0;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "starts_at" timestamp with time zone;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;

            CREATE TABLE IF NOT EXISTS "wallets" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
              "balance" double precision NOT NULL DEFAULT 0,
              "total_earned" double precision NOT NULL DEFAULT 0,
              "total_withdrawn" double precision NOT NULL DEFAULT 0,
              "created_at" timestamp with time zone NOT NULL DEFAULT now(),
              "updated_at" timestamp with time zone NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS "wallet_transactions" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
              "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
              "amount" double precision NOT NULL,
              "type" varchar(30) NOT NULL,
              "status" varchar(20) NOT NULL DEFAULT 'completed',
              "description" text NOT NULL,
              "order_id" uuid,
              "order_type" varchar(20),
              "coupon_code" varchar(50),
              "metadata" jsonb,
              "created_at" timestamp with time zone NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
              "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
              "amount" double precision NOT NULL,
              "payout_method" varchar(20) NOT NULL,
              "upi_id" varchar(100),
              "bank_account" varchar(50),
              "bank_ifsc" varchar(20),
              "account_holder_name" varchar(200),
              "status" varchar(20) NOT NULL DEFAULT 'pending',
              "admin_notes" text,
              "processed_at" timestamp with time zone,
              "created_at" timestamp with time zone NOT NULL DEFAULT now()
            );
          `);
                    }
                    catch (err) {
                        console.warn('[DB Init] Auto-migration notice:', err);
                    }
                    return (0, node_postgres_1.drizzle)(pool, { schema });
                },
            },
        ],
        exports: [exports.DRIZZLE],
    })
], DatabaseModule);
//# sourceMappingURL=database.module.js.map