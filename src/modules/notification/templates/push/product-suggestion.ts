import type { PushMessage } from '../../notification.types';

// Wired in Phase 9 (Product Suggestions) — see CatalogService.approveProductSuggestion
// / rejectProductSuggestion. `screen` opens the Vendor app's suggestions
// screen when tapped.
export function productSuggestionApprovedVendorPush(productName: string): PushMessage {
  return {
    title: 'Suggestion approved',
    body: `Your product suggestion "${productName}" was approved and is now in the Laoji catalog.`,
    data: { event: 'product_suggestion_approved', screen: '/suggest-product' },
  };
}

export function productSuggestionRejectedVendorPush(productName: string): PushMessage {
  return {
    title: 'Suggestion rejected',
    body: `Your product suggestion "${productName}" was not approved.`,
    data: { event: 'product_suggestion_rejected', screen: '/suggest-product' },
  };
}
