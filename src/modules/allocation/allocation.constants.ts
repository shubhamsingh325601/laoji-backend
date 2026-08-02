// PRD Section 7.3 left the vendor-acceptance SLA window and max retry count
// as open questions ("30 seconds? 2 minutes?" / "recommend starting at 2–3
// attempts"). Picked concrete defaults here rather than leaving them
// unset — flagged as assumptions, both overridable via env for testing.
export const ALLOCATION_SLA_SECONDS = Number(process.env.ALLOCATION_SLA_SECONDS ?? 120);
export const MAX_ALLOCATION_ATTEMPTS = Number(process.env.MAX_ALLOCATION_ATTEMPTS ?? 3);
