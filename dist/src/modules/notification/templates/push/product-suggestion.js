"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productSuggestionApprovedVendorPush = productSuggestionApprovedVendorPush;
exports.productSuggestionRejectedVendorPush = productSuggestionRejectedVendorPush;
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
//# sourceMappingURL=product-suggestion.js.map