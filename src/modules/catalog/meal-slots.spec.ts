import { BadRequestException } from '@nestjs/common';
import { isDefaultPickup, istDateString } from './catalog.types';
import {
  DEFAULT_MEAL_TIMINGS,
  describeMealSlots,
  effectiveMealTimings,
  isServedNow,
  mealSlotsNow,
  normalizeMealSlots,
  validateMealTimings,
} from './meal-slots';

// IST is UTC+05:30, so these build instants from an IST wall-clock time.
const ist = (hhmm: string, day = '2026-09-24') => new Date(`${day}T${hhmm}:00+05:30`);

describe('meal slots', () => {
  const defaults = effectiveMealTimings(null);

  it('falls back to the default window for every slot a restaurant has not set', () => {
    expect(defaults).toEqual(DEFAULT_MEAL_TIMINGS);
    expect(effectiveMealTimings([{ slot: 'lunch', start: '11:30', end: '15:00' }])).toEqual([
      { slot: 'breakfast', start: '07:00', end: '11:00' },
      { slot: 'lunch', start: '11:30', end: '15:00' },
      { slot: 'dinner', start: '19:00', end: '23:00' },
    ]);
  });

  it('serves an item with no slots all day', () => {
    for (const time of ['00:00', '04:30', '15:00', '23:59']) {
      expect(isServedNow(null, defaults, ist(time))).toBe(true);
      expect(isServedNow([], defaults, ist(time))).toBe(true);
    }
  });

  it('serves a slotted item only inside one of its windows (start inclusive, end exclusive)', () => {
    expect(isServedNow(['breakfast'], defaults, ist('07:00'))).toBe(true);
    expect(isServedNow(['breakfast'], defaults, ist('10:59'))).toBe(true);
    expect(isServedNow(['breakfast'], defaults, ist('11:00'))).toBe(false);
    expect(isServedNow(['breakfast'], defaults, ist('13:00'))).toBe(false);
    expect(isServedNow(['lunch', 'dinner'], defaults, ist('13:00'))).toBe(true);
    expect(isServedNow(['lunch', 'dinner'], defaults, ist('20:30'))).toBe(true);
    expect(isServedNow(['lunch', 'dinner'], defaults, ist('17:00'))).toBe(false);
  });

  it('evaluates in IST regardless of the server clock', () => {
    // 02:30 UTC is 08:00 IST — breakfast time in Kolhapur.
    expect(isServedNow(['breakfast'], defaults, new Date('2026-09-24T02:30:00Z'))).toBe(true);
    expect(isServedNow(['dinner'], defaults, new Date('2026-09-24T02:30:00Z'))).toBe(false);
  });

  it('handles a window that runs past midnight', () => {
    const lateDinner = effectiveMealTimings([{ slot: 'dinner', start: '19:00', end: '01:00' }]);
    expect(isServedNow(['dinner'], lateDinner, ist('23:30'))).toBe(true);
    expect(isServedNow(['dinner'], lateDinner, ist('00:30'))).toBe(true);
    expect(isServedNow(['dinner'], lateDinner, ist('01:00'))).toBe(false);
    expect(isServedNow(['dinner'], lateDinner, ist('18:59'))).toBe(false);
    expect(mealSlotsNow(lateDinner, ist('00:15'))).toEqual(['dinner']);
  });

  it('normalizes item slots to breakfast → dinner order without duplicates', () => {
    expect(normalizeMealSlots(['dinner', 'breakfast', 'dinner'])).toEqual(['breakfast', 'dinner']);
    expect(normalizeMealSlots([])).toBeNull();
    expect(normalizeMealSlots(undefined)).toBeNull();
  });

  it('rejects a timings update with a repeated slot or an empty window', () => {
    expect(() =>
      validateMealTimings([
        { slot: 'lunch', start: '12:00', end: '15:00' },
        { slot: 'lunch', start: '13:00', end: '16:00' },
      ]),
    ).toThrow(BadRequestException);
    expect(() => validateMealTimings([{ slot: 'dinner', start: '19:00', end: '19:00' }])).toThrow(BadRequestException);
    expect(() => validateMealTimings([{ slot: 'dinner', start: '19:00', end: '01:00' }])).not.toThrow();
  });

  it('describes slots with their windows for error messages', () => {
    expect(describeMealSlots(['breakfast', 'dinner'], defaults)).toBe('Breakfast (07:00–11:00), Dinner (19:00–23:00)');
  });
});

describe('catalog helpers', () => {
  it('gives the IST calendar date, which is ahead of UTC late in the evening', () => {
    expect(istDateString(new Date('2026-09-24T12:00:00Z'))).toBe('2026-09-24');
    expect(istDateString(new Date('2026-09-24T19:00:00Z'))).toBe('2026-09-25');
  });

  it('recognises only the exact fallback pickup points, current (Sangod) and old (Kolhapur)', () => {
    expect(isDefaultPickup(24.924, 76.283)).toBe(true);
    expect(isDefaultPickup(16.705, 74.2433)).toBe(true);
    expect(isDefaultPickup(24.9241, 76.283)).toBe(false);
    expect(isDefaultPickup(16.7051, 74.2433)).toBe(false);
  });
});
