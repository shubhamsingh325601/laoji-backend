"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUSINESS_TYPE_ROOT_CATEGORY = exports.BUSINESS_TYPES = void 0;
exports.haversineKm = haversineKm;
exports.categoryBusinessType = categoryBusinessType;
exports.isCategoryVisibleTo = isCategoryVisibleTo;
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
exports.BUSINESS_TYPES = [
    'grocery',
    'restaurant',
    'clothing',
    'stationery',
    'medical',
    'vegetables_fruits',
    'electronics',
    'general',
];
exports.BUSINESS_TYPE_ROOT_CATEGORY = {
    grocery: 'Grocery',
    clothing: 'Clothing',
    stationery: 'Stationery',
    medical: 'Medical',
    vegetables_fruits: 'Fruits & Vegetables',
    electronics: 'Electronics',
    general: 'General Store',
};
function categoryBusinessType(category, byId) {
    if (category.businessType)
        return category.businessType;
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    return parent?.businessType ?? 'grocery';
}
function isCategoryVisibleTo(categoryType, vendorBusinessType) {
    return vendorBusinessType === 'general' || categoryType === vendorBusinessType;
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