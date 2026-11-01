import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { platformSettings } from '../../../drizzle/schema';
import { ResponseCacheService } from '../../common/cache/response-cache.service';
import { HOME_TAB_KEYS, type HomeTabDto, type HomeTabKey } from './dto/home-tab.dto';

export const HOME_TABS_SETTING = 'home_tabs';

export interface HomeTab {
  key: HomeTabKey;
  label: string;
  isActive: boolean;
}

const DEFAULT_TABS: HomeTab[] = [
  { key: 'grocery', label: 'Grocery', isActive: true },
  { key: 'non_veg', label: 'Non-Veg', isActive: true },
  { key: 'veg', label: 'Veg', isActive: true },
];

// The Customer home-screen quick tabs (Grocery / Non-Veg / Veg). Stored as one
// JSON row in platform_settings; until an admin saves, the defaults apply.
@Injectable()
export class HomeTabService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(ResponseCacheService) private readonly cache?: ResponseCacheService,
  ) {}

  // Every tab, in display order, including hidden ones (admin view).
  async listAll(): Promise<HomeTab[]> {
    const [row] = await this.db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, HOME_TABS_SETTING))
      .limit(1);
    if (!row) return DEFAULT_TABS;
    try {
      const saved = JSON.parse(row.value) as HomeTab[];
      const valid = saved.filter((t) => (HOME_TAB_KEYS as readonly string[]).includes(t.key));
      // A key added to the app later still shows up, at the end.
      const missing = DEFAULT_TABS.filter((d) => !valid.some((t) => t.key === d.key));
      return [...valid, ...missing];
    } catch {
      return DEFAULT_TABS;
    }
  }

  // What the Customer app shows.
  async listLive(): Promise<Pick<HomeTab, 'key' | 'label'>[]> {
    return (await this.listAll()).filter((t) => t.isActive).map(({ key, label }) => ({ key, label }));
  }

  async update(tabs: HomeTabDto[], adminId?: string): Promise<HomeTab[]> {
    const keys = new Set(tabs.map((t) => t.key));
    if (keys.size !== HOME_TAB_KEYS.length) {
      throw new BadRequestException('Each of grocery, veg and non_veg must appear exactly once');
    }
    const value = JSON.stringify(
      tabs.map((t) => ({ key: t.key, label: t.label.trim(), isActive: t.isActive })),
    );
    await this.db
      .insert(platformSettings)
      .values({
        key: HOME_TABS_SETTING,
        value,
        description: 'Customer home screen tabs: order, labels and visibility',
        updatedBy: adminId,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value, updatedAt: new Date(), updatedBy: adminId },
      });
    this.cache?.clear();
    return this.listAll();
  }
}
