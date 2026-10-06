import { DeliveryService } from './delivery.service';
import { deliveryPartners, foodOrders, groceryOrders } from '../../../drizzle/schema';
import { PARTNER_HEARTBEAT_MAX_AGE_MS } from './delivery.constants';

// A db whose select().from(table).where(...) returns the rows registered for
// that table; filters are not evaluated, so each test sets up exactly the rows
// the query under test should see.
function fakeDb(rowsByTable: Map<unknown, unknown[]>) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => rowsByTable.get(table) ?? [],
      }),
    }),
  };
}

const PICKUP = { lat: 24.924, lng: 76.283 };

function partner(id: string, opts: { km?: number; ageMs?: number } = {}) {
  // ~0.009 degrees of latitude is about 1 km.
  return {
    id,
    userId: `user-${id}`,
    isOnline: true,
    currentLat: PICKUP.lat + (opts.km ?? 1) * 0.009,
    currentLng: PICKUP.lng,
    updatedAt: new Date(Date.now() - (opts.ageMs ?? 0)),
  };
}

function matcher(opts: { partners: unknown[]; busyGrocery?: string[]; busyFood?: string[] }) {
  const rows = new Map<unknown, unknown[]>([
    [deliveryPartners, opts.partners],
    [groceryOrders, (opts.busyGrocery ?? []).map((partnerId) => ({ partnerId }))],
    [foodOrders, (opts.busyFood ?? []).map((partnerId) => ({ partnerId }))],
  ]);
  const service = new DeliveryService(fakeDb(rows) as any, null as any, null as any, null as any, null as any, null as any);
  return (exclude: string[] = []) =>
    (service as any).findNearestOnlinePartner(PICKUP.lat, PICKUP.lng, exclude) as Promise<{ id: string } | null>;
}

const STALE = PARTNER_HEARTBEAT_MAX_AGE_MS + 60_000;

describe('DeliveryService.findNearestOnlinePartner', () => {
  it('picks the nearest partner', async () => {
    const find = matcher({ partners: [partner('far', { km: 4 }), partner('near', { km: 1 }), partner('mid', { km: 2 })] });
    expect((await find())?.id).toBe('near');
  });

  it('skips a partner who is already mid-delivery, even the nearest', async () => {
    const find = matcher({
      partners: [partner('near', { km: 1 }), partner('far', { km: 4 })],
      busyGrocery: ['near'],
    });
    expect((await find())?.id).toBe('far');
  });

  it('counts a food delivery as busy too', async () => {
    const find = matcher({ partners: [partner('near', { km: 1 }), partner('far', { km: 4 })], busyFood: ['near'] });
    expect((await find())?.id).toBe('far');
  });

  it('returns nobody when every online partner is busy, so the order waits', async () => {
    const find = matcher({ partners: [partner('a'), partner('b')], busyGrocery: ['a'], busyFood: ['b'] });
    expect(await find()).toBeNull();
  });

  it('prefers a recently seen partner over a closer one who went quiet', async () => {
    const find = matcher({
      partners: [partner('quiet-near', { km: 0.5, ageMs: STALE }), partner('live-far', { km: 3 })],
    });
    expect((await find())?.id).toBe('live-far');
  });

  it('still offers to a quiet partner when nobody has been heard from recently', async () => {
    const find = matcher({
      partners: [partner('quiet-near', { km: 0.5, ageMs: STALE }), partner('quiet-far', { km: 3, ageMs: STALE })],
    });
    expect((await find())?.id).toBe('quiet-near');
  });

  it('never re-offers to a partner who already had this order', async () => {
    const find = matcher({ partners: [partner('tried', { km: 1 }), partner('next', { km: 2 })] });
    expect((await find(['tried']))?.id).toBe('next');
    expect(await find(['tried', 'next'])).toBeNull();
  });
});
