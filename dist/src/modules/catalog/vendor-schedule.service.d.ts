import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Db } from '../../config/database.module';
export declare class VendorScheduleService implements OnModuleInit, OnModuleDestroy {
    private readonly db;
    private readonly logger;
    private timer?;
    private running;
    constructor(db: Db);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    tick(now?: Date): Promise<void>;
}
