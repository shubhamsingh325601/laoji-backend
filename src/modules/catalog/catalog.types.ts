/** Haversine great-circle distance in kilometres. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export interface BusinessHoursDay {
  day: number; // 0=Sun .. 6=Sat
  isOpen: boolean;
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
}

/**
 * Computed, not stored — matches this codebase's "fetch rows, compute in
 * JS" style (CatalogService's own Haversine filtering, DashboardService's
 * stuck-order detection) rather than trying to keep a boolean column in
 * sync with wall-clock time via a cron job that doesn't exist (TRD Section
 * 8 — no background scheduler beyond in-process setTimeout).
 *
 * `isOpen` is the manual master switch (vendor can force-close any time,
 * e.g. a holiday, regardless of the schedule). If no schedule is
 * configured yet (`businessHours` null/empty), `isOpen` alone decides it —
 * this keeps every vendor that predates this feature (or never bothers
 * with a weekly schedule) working exactly as before. Single-city MVP runs
 * on IST; "now" is evaluated in Asia/Kolkata regardless of server TZ.
 */
export function isVendorOpenNow(
  vendor: { isOpen: boolean; businessHours: BusinessHoursDay[] | null },
  now: Date = new Date(),
): boolean {
  if (!vendor.isOpen) return false;
  if (!vendor.businessHours || vendor.businessHours.length === 0) return true;

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
  if (!today || !today.isOpen) return false;

  const [openH, openM] = today.openTime.split(':').map(Number);
  const [closeH, closeM] = today.closeTime.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Same-day window only (no overnight-crossing hours, e.g. 22:00-02:00) —
  // not needed for a single-city MVP's typical grocery/restaurant hours,
  // flagged rather than silently half-handled.
  return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}
