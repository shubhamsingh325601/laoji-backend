import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { banners } from '../../../drizzle/schema';
import type { BannerPlacement, CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

@Injectable()
export class BannerService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  listAllForAdmin() {
    return this.db.select().from(banners).orderBy(asc(banners.placement), asc(banners.sortOrder), desc(banners.createdAt));
  }

  // What the Customer app shows: active and inside its date window.
  listLive(placement: BannerPlacement) {
    const now = new Date();
    return this.db
      .select({
        id: banners.id,
        title: banners.title,
        subtitle: banners.subtitle,
        imageUrl: banners.imageUrl,
        link: banners.link,
      })
      .from(banners)
      .where(
        and(
          eq(banners.isActive, true),
          eq(banners.placement, placement),
          or(isNull(banners.startsAt), lte(banners.startsAt, now)),
          or(isNull(banners.endsAt), gte(banners.endsAt, now)),
        ),
      )
      .orderBy(asc(banners.sortOrder), desc(banners.createdAt));
  }

  async create(dto: CreateBannerDto) {
    const [row] = await this.db
      .insert(banners)
      .values({
        title: dto.title.trim(),
        subtitle: dto.subtitle?.trim() || null,
        imageUrl: dto.imageUrl,
        link: dto.link?.trim() || null,
        placement: dto.placement ?? 'home',
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      })
      .returning();
    return row;
  }

  async update(id: string, dto: UpdateBannerDto) {
    await this.findOrThrow(id);
    const updates: Partial<typeof banners.$inferInsert> = {};
    if (dto.title !== undefined) updates.title = dto.title.trim();
    if (dto.subtitle !== undefined) updates.subtitle = dto.subtitle?.trim() || null;
    if (dto.imageUrl !== undefined) updates.imageUrl = dto.imageUrl;
    if (dto.link !== undefined) updates.link = dto.link?.trim() || null;
    if (dto.placement !== undefined) updates.placement = dto.placement;
    if (dto.sortOrder !== undefined) updates.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    if (dto.startsAt !== undefined) updates.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined) updates.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    const [row] = await this.db.update(banners).set(updates).where(eq(banners.id, id)).returning();
    return row;
  }

  async delete(id: string) {
    await this.findOrThrow(id);
    await this.db.delete(banners).where(eq(banners.id, id));
    return { success: true };
  }

  private async findOrThrow(id: string) {
    const [row] = await this.db.select().from(banners).where(eq(banners.id, id)).limit(1);
    if (!row) throw new NotFoundException('Banner not found');
    return row;
  }
}
