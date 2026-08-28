"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDurationMs = parseDurationMs;
const UNIT_MS = {
    s: 1000,
    sec: 1000,
    seconds: 1000,
    m: 60_000,
    min: 60_000,
    mins: 60_000,
    minutes: 60_000,
    h: 3_600_000,
    hr: 3_600_000,
    hours: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
    days: 86_400_000,
    w: 604_800_000,
    week: 604_800_000,
    weeks: 604_800_000,
};
function parseDurationMs(input, defaultMs = 15 * 60 * 1000) {
    if (input === undefined || input === null)
        return defaultMs;
    if (typeof input === 'number') {
        return input > 100_000 ? input : input * 1000;
    }
    const str = String(input).trim();
    if (/^\d+$/.test(str)) {
        const num = Number(str);
        return num > 100_000 ? num : num * 1000;
    }
    const match = /^(\d+)\s*([a-zA-Z]+)$/.exec(str);
    if (match) {
        const [, amount, unit] = match;
        const mult = UNIT_MS[unit.toLowerCase()];
        if (mult) {
            return Number(amount) * mult;
        }
    }
    return defaultMs;
}
//# sourceMappingURL=duration.js.map