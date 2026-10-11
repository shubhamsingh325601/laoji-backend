"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorRegisteredAdminPush = vendorRegisteredAdminPush;
exports.kycSubmittedAdminPush = kycSubmittedAdminPush;
function vendorRegisteredAdminPush(businessName, ownerName, vendorId) {
    const ownerPart = ownerName ? ` (${ownerName})` : '';
    return {
        title: '🏪 New Vendor Registered',
        body: `${businessName}${ownerPart} has registered on Laoji. Tap to view profile.`,
        data: {
            event: 'vendor_registered',
            businessName,
            ...(vendorId ? { vendorId, link: `/vendors/${vendorId}`, url: `/vendors/${vendorId}` } : {}),
        },
    };
}
function kycSubmittedAdminPush(userName, role, docType) {
    const roleLabel = role === 'vendor' ? 'Vendor' : role === 'delivery_partner' ? 'Delivery Partner' : 'User';
    const formattedDoc = docType.replace(/_/g, ' ');
    return {
        title: '📄 New KYC Document Submitted',
        body: `${roleLabel} "${userName}" uploaded ${formattedDoc} for review.`,
        data: {
            event: 'kyc_submitted',
            role,
            link: '/kyc-review',
            url: '/kyc-review',
        },
    };
}
//# sourceMappingURL=vendor-onboarding.js.map