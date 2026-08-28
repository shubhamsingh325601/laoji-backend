import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../drizzle/schema';
export declare const DRIZZLE: unique symbol;
export type Db = NodePgDatabase<typeof schema>;
export declare class DatabaseModule {
}
