"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productSuggestionApprovedVendorPush = productSuggestionApprovedVendorPush;
exports.productSuggestionRejectedVendorPush = productSuggestionRejectedVendorPush;
exports.productSuggestionCreatedAdminPush = productSuggestionCreatedAdminPush;
function productSuggestionApprovedVendorPush(productName) {
    return {
        title: 'Suggestion approved',
        body: `Your product suggestion "${productName}" was approved and is now in the Laoji catalog.`,
        data: { event: 'product_suggestion_approved', screen: '/suggest-product' },
    };
}
function productSuggestionRejectedVendorPush(productName) {
    return {
        title: 'Suggestion rejected',
        body: `Your product suggestion "${productName}" was not approved.`,
        data: { event: 'product_suggestion_rejected', screen: '/suggest-product' },
    };
}
function productSuggestionCreatedAdminPush(productName, categoryName, vendorName) {
    const catPart = categoryName ? ` under ${categoryName}` : '';
    const vendorPart = vendorName ? ` by ${vendorName}` : '';
    return {
        title: '📦 New Product Suggestion',
        body: `New item "${productName}" suggested${catPart}${vendorPart}. Tap to review.`,
        data: {
            event: 'product_suggestion',
            productName,
            link: '/product-suggestions',
            url: '/product-suggestions',
        },
    };
}
//# sourceMappingURL=product-suggestion.js.map