import { findCoveringArea, validateServiceArea } from './service-area.service';
import { minOrderForDistance, validateMinOrderTiers, validatePricingSettings } from '../revenue/pricing.service';
import { validateSplash } from '../splash/splash.service';

const sangod = { centerLat: 24.924, centerLng: 76.283, radiusKm: 10 };

describe('service areas', () => {
  it('covers a point 9 km out but not 11 km out (default 10 km)', () => {
    // 1 degree of latitude is about 111 km.
    expect(findCoveringArea([sangod], 24.924 + 9 / 111, 76.283)).toBe(sangod);
    expect(findCoveringArea([sangod], 24.924 + 11 / 111, 76.283)).toBeNull();
  });

  it('prefers the covering area with the nearest centre', () => {
    const near = { centerLat: 24.95, centerLng: 76.283, radiusKm: 5 };
    expect(findCoveringArea([sangod, near], 24.95, 76.283)).toBe(near);
  });

  it('defaults the radius to 10 km and rejects bad input', () => {
    expect(validateServiceArea({ name: ' Sangod ', centerLat: 24.9, centerLng: 76.2 })).toMatchObject({
      name: 'Sangod',
      radiusKm: 10,
      isActive: true,
    });
    expect(() => validateServiceArea({ name: '', centerLat: 1, centerLng: 1 })).toThrow();
    expect(() => validateServiceArea({ name: 'x', centerLat: 91, centerLng: 1 })).toThrow();
    expect(() => validateServiceArea({ name: 'x', centerLat: 1, centerLng: 1, radiusKm: 0 })).toThrow();
  });
});

describe('minimum order by distance', () => {
  const tiers = validateMinOrderTiers([
    { fromKm: 0, toKm: 3, minOrderAmount: 50 },
    { fromKm: 3, toKm: 6, minOrderAmount: 99 },
    { fromKm: 6, toKm: null, minOrderAmount: 149 },
  ]);

  it('picks the band a distance falls in, upper edge inclusive', () => {
    expect(minOrderForDistance(tiers, 0)).toBe(50);
    expect(minOrderForDistance(tiers, 3)).toBe(50);
    expect(minOrderForDistance(tiers, 3.1)).toBe(99);
    expect(minOrderForDistance(tiers, 40)).toBe(149);
  });

  it('is null with no bands so the global minimum applies', () => {
    expect(minOrderForDistance([], 4)).toBeNull();
  });

  it('rejects gaps, a first band not at 0 and a capped last band', () => {
    expect(() => validateMinOrderTiers([{ fromKm: 1, toKm: null, minOrderAmount: 50 }])).toThrow(/start at 0/);
    expect(() =>
      validateMinOrderTiers([
        { fromKm: 0, toKm: 3, minOrderAmount: 50 },
        { fromKm: 4, toKm: null, minOrderAmount: 99 },
      ]),
    ).toThrow(/no gaps/);
    expect(() => validateMinOrderTiers([{ fromKm: 0, toKm: 3, minOrderAmount: 50 }])).toThrow(/no upper limit/);
  });
});

describe('pricing settings and splash', () => {
  it('validates pricing settings', () => {
    expect(validatePricingSettings({ outerZoneRadiusKm: 2, outerZoneFee: 15, longDistanceKm: 5, longDistanceFreeMin: 200 })).toEqual({
      outerZoneRadiusKm: 2,
      outerZoneFee: 15,
      longDistanceKm: 5,
      longDistanceFreeMin: 200,
    });
    expect(() => validatePricingSettings({ outerZoneRadiusKm: -1, outerZoneFee: 15, longDistanceKm: 5, longDistanceFreeMin: 200 })).toThrow();
  });

  it('needs an https image to turn the splash on, and a sane duration', () => {
    expect(() => validateSplash({ enabled: true, imageUrl: null, durationMs: 3000, skippable: true })).toThrow(/image/i);
    expect(() => validateSplash({ enabled: false, imageUrl: 'http://x/y.png', durationMs: 3000, skippable: true })).toThrow(/https/);
    expect(() => validateSplash({ enabled: false, imageUrl: null, durationMs: 100, skippable: true })).toThrow(/Display time/);
    expect(validateSplash({ enabled: true, imageUrl: 'https://x/y.png', durationMs: 3000, skippable: false })).toEqual({
      enabled: true,
      imageUrl: 'https://x/y.png',
      durationMs: 3000,
      skippable: false,
    });
  });
});
