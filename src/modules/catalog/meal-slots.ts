import { BadRequestException } from '@nestjs/common';

// Meal slots a restaurant can tag its menu items with. Each slot's window
// comes from the restaurant's own `restaurants.meal_timings`, falling back to
// the default below. An item with no slots is served all day, which is what
// every item created before this feature is.
//
// Evaluated in Asia/Kolkata like `isVendorOpenNow`. Unlike business hours, a
// window may run past midnight (a 19:00–01:00 dinner): an end time earlier
// than the start time means "the next day".

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export interface MealTiming {
  slot: MealSlot;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

const LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export const DEFAULT_MEAL_TIMINGS: MealTiming[] = [
  { slot: 'breakfast', start: '07:00', end: '11:00' },
  { slot: 'lunch', start: '12:00', end: '16:00' },
  { slot: 'dinner', start: '19:00', end: '23:00' },
];

type StoredTimings = { slot: string; start: string; end: string }[] | null | undefined;

/** Every slot's window: the restaurant's own where it set one, else the default. */
export function effectiveMealTimings(stored: StoredTimings): MealTiming[] {
  return DEFAULT_MEAL_TIMINGS.map((fallback) => {
    const own = stored?.find((t) => t.slot === fallback.slot);
    return own ? { slot: fallback.slot, start: own.start, end: own.end } : fallback;
  });
}

/** The windows as the apps show them, with a display label per slot. */
export function mealTimingsView(stored: StoredTimings) {
  return effectiveMealTimings(stored).map((t) => ({ ...t, label: LABELS[t.slot] }));
}

/** An item's slots deduplicated in breakfast → dinner order; null = all day. */
export function normalizeMealSlots(slots: string[] | null | undefined): MealSlot[] | null {
  if (!slots || slots.length === 0) return null;
  const chosen = new Set(slots);
  const ordered = MEAL_SLOTS.filter((s) => chosen.has(s));
  return ordered.length > 0 ? ordered : null;
}

/** Rejects a timings update that lists a slot twice or has an empty window. */
export function validateMealTimings(timings: MealTiming[]): void {
  const seen = new Set<string>();
  for (const t of timings) {
    if (seen.has(t.slot)) throw new BadRequestException(`${LABELS[t.slot]} is listed more than once`);
    seen.add(t.slot);
    if (t.start === t.end) {
      throw new BadRequestException(`${LABELS[t.slot]} must end at a different time than it starts`);
    }
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function istMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function isWithin(timing: MealTiming, nowMinutes: number): boolean {
  const start = toMinutes(timing.start);
  const end = toMinutes(timing.end);
  return start < end ? nowMinutes >= start && nowMinutes < end : nowMinutes >= start || nowMinutes < end;
}

/** Slots being served at `now`. */
export function mealSlotsNow(timings: MealTiming[], now: Date = new Date()): MealSlot[] {
  const nowMinutes = istMinutes(now);
  return timings.filter((t) => isWithin(t, nowMinutes)).map((t) => t.slot);
}

/** Whether an item tagged with `mealSlots` can be ordered at `now`. */
export function isServedNow(mealSlots: string[] | null | undefined, timings: MealTiming[], now: Date = new Date()): boolean {
  if (!mealSlots || mealSlots.length === 0) return true;
  const serving = mealSlotsNow(timings, now);
  return mealSlots.some((s) => (serving as string[]).includes(s));
}

/** e.g. "Breakfast (07:00–11:00), Dinner (19:00–23:00)", for error messages. */
export function describeMealSlots(mealSlots: string[], timings: MealTiming[]): string {
  return mealSlots
    .map((s) => {
      const t = timings.find((x) => x.slot === s);
      return t ? `${LABELS[t.slot]} (${t.start}–${t.end})` : s;
    })
    .join(', ');
}
