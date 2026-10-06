import { CORE_DELIVERY_RADIUS_KM, DEFAULT_PICKUP, isOutsideCoreZone } from './catalog.types';

describe('isOutsideCoreZone', () => {
  it('treats Sangod centre as inside', () => {
    expect(isOutsideCoreZone(DEFAULT_PICKUP.lat, DEFAULT_PICKUP.lng)).toBe(false);
  });

  it('treats a point ~1 km away as inside', () => {
    // 0.009 deg of latitude is about 1 km
    expect(isOutsideCoreZone(DEFAULT_PICKUP.lat + 0.009, DEFAULT_PICKUP.lng)).toBe(false);
  });

  it('treats a point ~3 km away as outside', () => {
    expect(isOutsideCoreZone(DEFAULT_PICKUP.lat + 0.027, DEFAULT_PICKUP.lng)).toBe(true);
  });

  it('uses a 2 km radius', () => {
    expect(CORE_DELIVERY_RADIUS_KM).toBe(2);
  });
});
