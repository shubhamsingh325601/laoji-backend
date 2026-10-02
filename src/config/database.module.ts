import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../drizzle/schema';

export const DRIZZLE = Symbol('DRIZZLE');
export type Db = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const pool = new Pool({ connectionString: config.get<string>('DATABASE_URL') });
        try {
          await pool.query('ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "vendor_id" uuid;');
        } catch (err) {
          console.warn('[DB Init] Auto-migration notice:', err);
        }
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
