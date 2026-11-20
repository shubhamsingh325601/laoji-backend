import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { serviceAreas, vendors } from '../../../drizzle/schema';
import { haversineKm, roundKm } from '../catalog/catalog.types';

export const DEFAULT_SERVICE_RADIUS_KM = 10;
export const MAX_SERVICE_RADIUS_KM = 100;

export interface ServiceAreaInput {
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  isActive: boolean;
}

export interface ServiceAreaRow extends ServiceAreaInput {
  id: string;
}

/** Throws a 400 naming the first thing wrong with an area an admin typed in. */
export function validateServiceArea(input: unknown, partial = false): Partial<ServiceAreaInput> {
  const i = (input ?? {}) as Record<string, unknown>;
  const out: Partial<ServiceAreaInput> = {};
  if (!partial || i.name !== undefined) {
    const name = typeof i.name === 'string' ? i.name.trim() : '';
    if (!name) throw new BadRequestException('Give the area a name');
    out.name = name.slice(0, 120);
  }
  if (!partial || i.centerLat !== undefined) {
    const lat = Number(i.centerLat);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new BadRequestException('Latitude must be between -90 and 90');
    out.centerLat = lat;
  }
  if (!partial || i.centerLng !== undefined) {
    const lng = Number(i.centerLng);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new BadRequestException('Longitude must be between -180 and 180');
    out.centerLng = lng;
  }
  if (!partial || i.radiusKm !== undefined) {
    const radius = i.radiusKm === undefined ? DEFAULT_SERVICE_RADIUS_KM : Number(i.radiusKm);
    if (!Number.isFinite(radius) || radius <= 0 || radius > MAX_SERVICE_RADIUS_KM) {
      throw new BadRequestException(`Coverage radius must be more than 0 and at most ${MAX_SERVICE_RADIUS_KM} km`);
    }
    out.radiusKm = Math.round(radius * 100) / 100;
  }
  if (!partial || i.isActive !== undefined) {
    if (i.isActive !== undefined && typeof i.isActive !== 'boolean') throw new BadRequestException('"isActive" must be true or false');
    out.isActive = (i.isActive as boolean | undefined) ?? true;
  }
  return out;
}

/** The area whose circle holds the point; if several do, the one with the nearest centre. */
export function findCoveringArea<T extends { centerLat: number; centerLng: number; radiusKm: number }>(
  areas: T[],
  lat: number,
  lng: number,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const a of areas) {
    const distance = haversineKm(a.centerLat, a.centerLng, lat, lng);
    if (distance <= a.radiusKm && distance < bestDistance) {
      best = a;
      bestDistance = distance;
    }
  }
  return best;
}

function toRow(r: typeof serviceAreas.$inferSelect): ServiceAreaRow {
  return { id: r.id, name: r.name, centerLat: r.centerLat, centerLng: r.centerLng, radiusKm: r.radiusKm, isActive: r.isActive };
}

@Injectable()
export class ServiceAreaService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async list(onlyActive = false): Promise<ServiceAreaRow[]> {
    const rows = await this.db.select().from(serviceAreas).orderBy(asc(serviceAreas.name));
    return rows.filter((r) => !onlyActive || r.isActive).map(toRow);
  }

  async create(input: unknown): Promise<ServiceAreaRow> {
    const v = validateServiceArea(input) as ServiceAreaInput;
    const [row] = await this.db.insert(serviceAreas).values(v).returning();
    return toRow(row);
  }

  async update(id: string, input: unknown): Promise<ServiceAreaRow> {
    const v = validateServiceArea(input, true);
    const [row] = await this.db
      .update(serviceAreas)
      .set({ ...v, updatedAt: new Date() })
      .where(eq(serviceAreas.id, id))
      .returning();
    if (!row) throw new NotFoundException('Service area not found');
    return toRow(row);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const deleted = await this.db.delete(serviceAreas).where(eq(serviceAreas.id, id)).returning({ id: serviceAreas.id });
    if (!deleted.length) throw new NotFoundException('Service area not found');
    return { ok: true };
  }

  /**
   * Sets every vendor shop inside the area to deliver as far as the area's
   * radius. A vendor keeps its own radius otherwise, which is what held Sangod
   * to the old 4 km.
   */
  async applyRadiusToVendors(id: string): Promise<{ updated: number; radiusKm: number }> {
    const [area] = await this.db.select().from(serviceAreas).where(eq(serviceAreas.id, id)).limit(1);
    if (!area) throw new NotFoundException('Service area not found');
    const all = await this.db
      .select({ id: vendors.id, lat: vendors.pickupLat, lng: vendors.pickupLng, radius: vendors.radiusKm })
      .from(vendors);
    const ids = all
      .filter((v) => haversineKm(area.centerLat, area.centerLng, v.lat, v.lng) <= area.radiusKm && v.radius !== area.radiusKm)
      .map((v) => v.id);
    if (ids.length) await this.db.update(vendors).set({ radiusKm: area.radiusKm }).where(inArray(vendors.id, ids));
    return { updated: ids.length, radiusKm: area.radiusKm };
  }

  /**
   * The active area covering a point, or null. With no active areas at all
   * (nothing configured) `configured` is false and callers should not block.
   */
  async coverage(lat: number, lng: number): Promise<{ configured: boolean; area: ServiceAreaRow | null }> {
    const areas = await this.list(true);
    return { configured: areas.length > 0, area: findCoveringArea(areas, lat, lng) };
  }

  /** Throws if areas are configured and none of them reaches the point. */
  async assertCovered(lat: number, lng: number): Promise<ServiceAreaRow | null> {
    const areas = await this.list(true);
    if (!areas.length) return null;
    const area = findCoveringArea(areas, lat, lng);
    if (area) return area;
    const nearest = areas
      .map((a) => ({ a, d: haversineKm(a.centerLat, a.centerLng, lat, lng) }))
      .sort((x, y) => x.d - y.d)[0];
    throw new BadRequestException(
      `We don't deliver to this address yet. It is ${roundKm(nearest.d)} km from ${nearest.a.name}, and we serve within ${nearest.a.radiusKm} km.`,
    );
  }
}
