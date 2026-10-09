// Mirrors allocation.constants.ts's reasoning (PRD Section 7.3 left these as
// open questions) — same defaults, independently configurable since a
// delivery-partner assignment window doesn't have to match the vendor
// allocation window in practice, even though they start out equal.
// Re-assignment SLA timeout: 5 minutes (300 seconds)
export const DELIVERY_SLA_SECONDS = Number(process.env.DELIVERY_SLA_SECONDS ?? 300);

// Heartbeat / Doze mode / GPS location staleness window: 10 minutes (600 seconds)
export const PARTNER_HEARTBEAT_MAX_AGE_MS = Number(process.env.PARTNER_HEARTBEAT_MAX_AGE_SECONDS ?? 600) * 1000;

