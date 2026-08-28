"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineKm = haversineKm;
exports.isVendorOpenNow = isVendorOpenNow;
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function toRad(deg) {
    return (deg * Math.PI) / 180;
}
function isVendorOpenNow(vendor, now = new Date()) {
    if (!vendor.isOpen)
        return false;
    if (!vendor.businessHours || vendor.businessHours.length === 0)
        return true;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now);
    const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayShort);
    const nowMinutes = Number(hour) * 60 + Number(minute);
    const today = vendor.businessHours.find((d) => d.day === dayIndex);
    if (!today || !today.isOpen)
        return false;
    const [openH, openM] = today.openTime.split(':').map(Number);
    const [closeH, closeM] = today.closeTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}
//# sourceMappingURL=catalog.types.js.map