"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorySuggestionApprovedVendorPush = categorySuggestionApprovedVendorPush;
exports.categorySuggestionRejectedVendorPush = categorySuggestionRejectedVendorPush;
exports.categorySuggestionCreatedAdminPush = categorySuggestionCreatedAdminPush;
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
function categorySuggestionCreatedAdminPush(categoryName, businessType, vendorName) {
    const vendorPart = vendorName ? ` by ${vendorName}` : '';
    return {
        title: '📁 New Category Suggestion',
        body: `New category "${categoryName}" suggested${vendorPart}. Tap to review.`,
        data: {
            event: 'category_suggestion',
            categoryName,
            ...(businessType ? { businessType } : {}),
            link: '/catalog',
            url: '/catalog',
        },
    };
}
//# sourceMappingURL=category-suggestion.js.map