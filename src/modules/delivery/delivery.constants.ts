// Mirrors allocation.constants.ts's reasoning (PRD Section 7.3 left these as
// open questions) — same defaults, independently configurable since a
// delivery-partner assignment window doesn't have to match the vendor
// allocation window in practice, even though they start out equal.
export const DELIVERY_SLA_SECONDS = Number(process.env.DELIVERY_SLA_SECONDS ?? 120);
export const MAX_DELIVERY_ASSIGNMENT_ATTEMPTS = Number(process.env.MAX_DELIVERY_ASSIGNMENT_ATTEMPTS ?? 3);
