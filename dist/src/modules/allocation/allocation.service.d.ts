import type { Db } from '../../config/database.module';
import { JobQueueService } from './job-queue.service';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
export interface CartLine {
    productId: string;
    qty: number;
}
export interface AllocationCandidate {
    vendorId: string;
    unitPrices: Map<string, number>;
}
export declare class AllocationService {
    private readonly db;
    private readonly jobQueue;
    private readonly payments;
    private readonly notifications;
    private readonly logger;
    constructor(db: Db, jobQueue: JobQueueService, payments: PaymentService, notifications: NotificationService);
    findBestVendor(items: CartLine[], lat: number, lng: number, excludeVendorIds?: string[]): Promise<AllocationCandidate | null>;
    createAttempt(groceryOrderId: string, vendorId: string, attemptNo: number): Promise<{
        id: string;
        createdAt: Date;
        vendorId: string;
        groceryOrderId: string;
        outcome: "pending" | "rejected" | "accepted" | "timeout";
        attemptNo: number;
        slaDeadline: Date;
    }>;
    handleTimeout(attemptId: string): Promise<void>;
    handleRejection(attemptId: string): Promise<void>;
    handleAcceptance(attemptId: string): Omit<import("drizzle-orm/pg-core").PgUpdateBase<import("drizzle-orm/pg-core").PgTableWithColumns<{
        name: "allocation_attempts";
        schema: undefined;
        columns: {
            id: import("drizzle-orm/pg-core").PgColumn<{
                name: "id";
                tableName: "allocation_attempts";
                dataType: "string";
                columnType: "PgUUID";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: true;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                baseColumn: never;
                identity: undefined;
                generated: undefined;
            }, {}, {}>;
            groceryOrderId: import("drizzle-orm/pg-core").PgColumn<{
                name: "grocery_order_id";
                tableName: "allocation_attempts";
                dataType: "string";
                columnType: "PgUUID";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                baseColumn: never;
                identity: undefined;
                generated: undefined;
            }, {}, {}>;
            vendorId: import("drizzle-orm/pg-core").PgColumn<{
                name: "vendor_id";
                tableName: "allocation_attempts";
                dataType: "string";
                columnType: "PgUUID";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                baseColumn: never;
                identity: undefined;
                generated: undefined;
            }, {}, {}>;
            outcome: import("drizzle-orm/pg-core").PgColumn<{
                name: "outcome";
                tableName: "allocation_attempts";
                dataType: "string";
                columnType: "PgEnumColumn";
                data: "pending" | "rejected" | "accepted" | "timeout";
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: ["pending", "accepted", "rejected", "timeout"];
                baseColumn: never;
                identity: undefined;
                generated: undefined;
            }, {}, {}>;
            attemptNo: import("drizzle-orm/pg-core").PgColumn<{
                name: "attempt_no";
                tableName: "allocation_attempts";
                dataType: "number";
                columnType: "PgInteger";
                data: number;
                driverParam: string | number;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                baseColumn: never;
                identity: undefined;
                generated: undefined;
            }, {}, {}>;
            slaDeadline: import("drizzle-orm/pg-core").PgColumn<{
                name: "sla_deadline";
                tableName: "allocation_attempts";
                dataType: "date";
                columnType: "PgTimestamp";
                data: Date;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                baseColumn: never;
                identity: undefined;
                generated: undefined;
            }, {}, {}>;
            createdAt: import("drizzle-orm/pg-core").PgColumn<{
                name: "created_at";
                tableName: "allocation_attempts";
                dataType: "date";
                columnType: "PgTimestamp";
                data: Date;
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                baseColumn: never;
                identity: undefined;
                generated: undefined;
            }, {}, {}>;
        };
        dialect: "pg";
    }>, import("drizzle-orm/node-postgres").NodePgQueryResultHKT, undefined, undefined, undefined, Record<"allocation_attempts", "not-null">, [], false, "where" | "leftJoin" | "rightJoin" | "innerJoin" | "fullJoin">, "where" | "leftJoin" | "rightJoin" | "innerJoin" | "fullJoin">;
    private reallocate;
    private markFailed;
}
