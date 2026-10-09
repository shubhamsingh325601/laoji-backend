import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { restaurants, users, vendors } from '../../../drizzle/schema';
import { isWithinSchedule } from './catalog.types';

const TICK_MS = 20_000;

/**
 * Opens and closes vendors on their weekly schedule by flipping
 * `vendors.is_open` (and the linked `restaurants.is_open`) — the same switch
 * the admin and vendor apps show as "taking orders". Vendors never have to
 * toggle it daily.
 *
 * Only a change in the *scheduled* state is applied (tracked in
 * `vendors.schedule_state`), so a vendor/admin who force-closes mid-day stays
 * closed until the next opening time. A restart or missed tick self-heals on
 * the next run. Customer-side enforcement does not depend on this tick:
 * `isVendorOpenNow` also checks the window itself at query time.
 *
 * In-process timer — single backend instance, per CLAUDE.md rule #3.
 */
@Injectable()
export class VendorScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VendorScheduleService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async onModuleInit() {
    try {
      await this.db.execute(sql`ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "schedule_state" boolean`);
    } catch (err) {
      // App DB role may be DML-only; migration 0028 adds the column then.
      this.logger.warn(`schedule_state auto-migration skipped: ${err instanceof Error ? err.message : err}`);
    }
    await this.tick();
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now: Date = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.db
        .select({
          id: vendors.id,
          businessHours: vendors.businessHours,
          scheduleState: vendors.scheduleState,
          isOpen: vendors.isOpen,
        })
        .from(vendors)
        .innerJoin(users, eq(users.id, vendors.userId))
        .where(and(isNotNull(vendors.businessHours), eq(users.status, 'active')));

      for (const v of rows) {
        if (!v.businessHours || v.businessHours.length === 0) continue;
        const scheduledOpen = isWithinSchedule(v.businessHours, now);
        if (v.scheduleState === scheduledOpen) continue;

        await this.db
          .update(vendors)
          .set({ isOpen: scheduledOpen, scheduleState: scheduledOpen })
          .where(eq(vendors.id, v.id));
        await this.db.update(restaurants).set({ isOpen: scheduledOpen }).where(eq(restaurants.vendorId, v.id));
        this.logger.log(`Vendor ${v.id} ${scheduledOpen ? 'opened' : 'closed'} by schedule`);
      }
    } catch (err) {
      this.logger.error(`Schedule tick failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.running = false;
    }
  }
}
