import type { PushMessage } from '../../notification.types';

// Template-only — `product_suggestions` has no real backend yet (entirely
// frontend-mocked today), so nothing calls these. Written so the
// Notification Matrix is fully covered in code and ready to wire the
// moment that feature gets a real table/endpoints (deferred, flagged in
// CLAUDE.md — out of scope for a Notifications phase to build alone).
export function productSuggestionApprovedVendorPush(productName: string): PushMessage {
  return {
    title: 'Suggestion approved',
    body: `Your product suggestion "${productName}" was approved and is now listed.`,
    data: { event: 'product_suggestion_approved' },
  };
}

export function productSuggestionRejectedVendorPush(productName: string): PushMessage {
  return {
    title: 'Suggestion rejected',
    body: `Your product suggestion "${productName}" was not approved.`,
    data: { event: 'product_suggestion_rejected' },
  };
}
