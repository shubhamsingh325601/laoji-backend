import type { PushMessage } from '../../notification.types';

// See CatalogService.approveCategorySuggestion / rejectCategorySuggestion.
// `screen` opens the Vendor app's suggestions screen when tapped.
export function categorySuggestionApprovedVendorPush(categoryName: string): PushMessage {
  return {
    title: 'Category suggestion approved',
    body: `"${categoryName}" is now one of Laoji's categories.`,
    data: { event: 'category_suggestion_approved', screen: '/suggest-product' },
  };
}

export function categorySuggestionRejectedVendorPush(categoryName: string): PushMessage {
  return {
    title: 'Category suggestion rejected',
    body: `Your category suggestion "${categoryName}" was not approved.`,
    data: { event: 'category_suggestion_rejected', screen: '/suggest-product' },
  };
}
