import type { PushMessage } from '../../notification.types';

// Wired in Phase 9 (Product Suggestions) — see CatalogService.approveProductSuggestion
// / rejectProductSuggestion.
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
