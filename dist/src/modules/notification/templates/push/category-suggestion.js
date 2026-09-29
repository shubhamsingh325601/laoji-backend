"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorySuggestionApprovedVendorPush = categorySuggestionApprovedVendorPush;
exports.categorySuggestionRejectedVendorPush = categorySuggestionRejectedVendorPush;
function categorySuggestionApprovedVendorPush(categoryName) {
    return {
        title: 'Category suggestion approved',
        body: `"${categoryName}" is now one of Laoji's categories.`,
        data: { event: 'category_suggestion_approved', screen: '/suggest-product' },
    };
}
function categorySuggestionRejectedVendorPush(categoryName) {
    return {
        title: 'Category suggestion rejected',
        body: `Your category suggestion "${categoryName}" was not approved.`,
        data: { event: 'category_suggestion_rejected', screen: '/suggest-product' },
    };
}
//# sourceMappingURL=category-suggestion.js.map