import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { splashSettings } from '../../../drizzle/schema';

export const SPLASH_APPS = ['customer', 'vendor', 'rider'] as const;
export type SplashApp = (typeof SPLASH_APPS)[number];

export interface SplashConfig {
  app: SplashApp;
  enabled: boolean;
  imageUrl: string | null;
  durationMs: number;
  skippable: boolean;
}

export const MIN_SPLASH_MS = 1000;
export const MAX_SPLASH_MS = 10000;

export function assertSplashApp(app: unknown): SplashApp {
  if (!(SPLASH_APPS as readonly unknown[]).includes(app)) {
    throw new BadRequestException(`app must be one of: ${SPLASH_APPS.join(', ')}`);
  }
  return app as SplashApp;
}

export function validateSplash(input: unknown): Omit<SplashConfig, 'app'> {
  const i = (input ?? {}) as Record<string, unknown>;
  if (typeof i.enabled !== 'boolean') throw new BadRequestException('"enabled" must be true or false');
  if (typeof i.skippable !== 'boolean') throw new BadRequestException('"skippable" must be true or false');
  const durationMs = Number(i.durationMs);
  if (!Number.isFinite(durationMs) || durationMs < MIN_SPLASH_MS || durationMs > MAX_SPLASH_MS) {
    throw new BadRequestException(`Display time must be between ${MIN_SPLASH_MS / 1000} and ${MAX_SPLASH_MS / 1000} seconds`);
  }
  const imageUrl = typeof i.imageUrl === 'string' && i.imageUrl.trim() ? i.imageUrl.trim() : null;
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) throw new BadRequestException('Image must be an https URL');
  if (i.enabled && !imageUrl) throw new BadRequestException('Upload an image before turning the splash on');
  return { enabled: i.enabled, imageUrl, durationMs: Math.round(durationMs), skippable: i.skippable };
}

@Injectable()
export class SplashService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** `configured` is false until an admin has saved settings for the app. */
  async get(app: SplashApp): Promise<SplashConfig & { configured: boolean }> {
    const [row] = await this.db.select().from(splashSettings).where(eq(splashSettings.app, app)).limit(1);
    return row
      ? { app, configured: true, enabled: row.enabled, imageUrl: row.imageUrl, durationMs: row.durationMs, skippable: row.skippable }
      : { app, configured: false, enabled: false, imageUrl: null, durationMs: 2800, skippable: true };
  }

  listAll() {
    return Promise.all(SPLASH_APPS.map((a) => this.get(a)));
  }

  async save(app: SplashApp, input: unknown) {
    const v = validateSplash(input);
    await this.db
      .insert(splashSettings)
      .values({ app, ...v })
      .onConflictDoUpdate({ target: splashSettings.app, set: { ...v, updatedAt: new Date() } });
    return this.get(app);
  }
}
