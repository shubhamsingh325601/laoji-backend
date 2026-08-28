"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productSuggestionApprovedVendorPush = productSuggestionApprovedVendorPush;
exports.productSuggestionRejectedVendorPush = productSuggestionRejectedVendorPush;
function productSuggestionApprovedVendorPush(productName) {
    return {
        title: 'Suggestion approved',
        body: `Your product suggestion "${productName}" was approved and is now listed.`,
        data: { event: 'product_suggestion_approved' },
    };
}
function productSuggestionRejectedVendorPush(productName) {
    return {
        title: 'Suggestion rejected',
        body: `Your product suggestion "${productName}" was not approved.`,
        data: { event: 'product_suggestion_rejected' },
    };
}
//# sourceMappingURL=product-suggestion.js.map