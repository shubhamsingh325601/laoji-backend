import { BadRequestException } from '@nestjs/common';
import { DEFAULT_RIDER_PAYOUT_TIERS, riderPayoutForDistance, validateRiderPayoutTiers } from './rider-payout.service';

describe('riderPayoutForDistance', () => {
  const tiers = DEFAULT_RIDER_PAYOUT_TIERS; // 0-3: 5, 3-5: 10, 5+: 15

  it.each([
    [0, 5],
    [1, 5],
    [3, 5], // boundary belongs to the lower range, like the customer fee tiers
    [3.01, 10],
    [5, 10],
    [5.01, 15],
    [40, 15],
  ])('%s km pays ₹%s', (km, amount) => {
    expect(riderPayoutForDistance(tiers, km)).toBe(amount);
  });

  it('works with admin-defined ranges in any order', () => {
    const custom = [
      { fromKm: 4, toKm: null, amount: 30 },
      { fromKm: 0, toKm: 2, amount: 8 },
      { fromKm: 2, toKm: 4, amount: 18 },
    ];
    expect(riderPayoutForDistance(custom, 1.5)).toBe(8);
    expect(riderPayoutForDistance(custom, 2.5)).toBe(18);
    expect(riderPayoutForDistance(custom, 9)).toBe(30);
  });
});

describe('validateRiderPayoutTiers', () => {
  it('accepts the default ranges', () => {
    expect(validateRiderPayoutTiers(DEFAULT_RIDER_PAYOUT_TIERS)).toEqual(DEFAULT_RIDER_PAYOUT_TIERS);
  });

  it('accepts a single open-ended range', () => {
    expect(validateRiderPayoutTiers([{ fromKm: 0, toKm: null, amount: 12 }])).toHaveLength(1);
  });

  it.each([
    ['nothing', []],
    ['not starting at 0', [{ fromKm: 1, toKm: null, amount: 5 }]],
    ['a gap', [{ fromKm: 0, toKm: 3, amount: 5 }, { fromKm: 4, toKm: null, amount: 9 }]],
    ['an overlap', [{ fromKm: 0, toKm: 3, amount: 5 }, { fromKm: 2, toKm: null, amount: 9 }]],
    ['a closed last range', [{ fromKm: 0, toKm: 3, amount: 5 }]],
    ['an open range in the middle', [{ fromKm: 0, toKm: null, amount: 5 }, { fromKm: 3, toKm: null, amount: 9 }]],
    ['to <= from', [{ fromKm: 0, toKm: 0, amount: 5 }, { fromKm: 0, toKm: null, amount: 9 }]],
    ['a negative amount', [{ fromKm: 0, toKm: null, amount: -1 }]],
    ['a non-number amount', [{ fromKm: 0, toKm: null, amount: 'abc' }]],
  ])('rejects %s', (_label, input) => {
    expect(() => validateRiderPayoutTiers(input)).toThrow(BadRequestException);
  });
});
