"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MEAL_TIMINGS = exports.MEAL_SLOTS = void 0;
exports.effectiveMealTimings = effectiveMealTimings;
exports.mealTimingsView = mealTimingsView;
exports.normalizeMealSlots = normalizeMealSlots;
exports.validateMealTimings = validateMealTimings;
exports.mealSlotsNow = mealSlotsNow;
exports.isServedNow = isServedNow;
exports.describeMealSlots = describeMealSlots;
const common_1 = require("@nestjs/common");
exports.MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'];
const LABELS = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
};
exports.DEFAULT_MEAL_TIMINGS = [
    { slot: 'breakfast', start: '07:00', end: '11:00' },
    { slot: 'lunch', start: '12:00', end: '16:00' },
    { slot: 'dinner', start: '19:00', end: '23:00' },
];
function effectiveMealTimings(stored) {
    return exports.DEFAULT_MEAL_TIMINGS.map((fallback) => {
        const own = stored?.find((t) => t.slot === fallback.slot);
        return own ? { slot: fallback.slot, start: own.start, end: own.end } : fallback;
    });
}
function mealTimingsView(stored) {
    return effectiveMealTimings(stored).map((t) => ({ ...t, label: LABELS[t.slot] }));
}
function normalizeMealSlots(slots) {
    if (!slots || slots.length === 0)
        return null;
    const chosen = new Set(slots);
    const ordered = exports.MEAL_SLOTS.filter((s) => chosen.has(s));
    return ordered.length > 0 ? ordered : null;
}
function validateMealTimings(timings) {
    const seen = new Set();
    for (const t of timings) {
        if (seen.has(t.slot))
            throw new common_1.BadRequestException(`${LABELS[t.slot]} is listed more than once`);
        seen.add(t.slot);
        if (t.start === t.end) {
            throw new common_1.BadRequestException(`${LABELS[t.slot]} must end at a different time than it starts`);
        }
    }
}
function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
function istMinutes(now) {
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
function isWithin(timing, nowMinutes) {
    const start = toMinutes(timing.start);
    const end = toMinutes(timing.end);
    return start < end ? nowMinutes >= start && nowMinutes < end : nowMinutes >= start || nowMinutes < end;
}
function mealSlotsNow(timings, now = new Date()) {
    const nowMinutes = istMinutes(now);
    return timings.filter((t) => isWithin(t, nowMinutes)).map((t) => t.slot);
}
function isServedNow(mealSlots, timings, now = new Date()) {
    if (!mealSlots || mealSlots.length === 0)
        return true;
    const serving = mealSlotsNow(timings, now);
    return mealSlots.some((s) => serving.includes(s));
}
function describeMealSlots(mealSlots, timings) {
    return mealSlots
        .map((s) => {
        const t = timings.find((x) => x.slot === s);
        return t ? `${LABELS[t.slot]} (${t.start}–${t.end})` : s;
    })
        .join(', ');
}
//# sourceMappingURL=meal-slots.js.map