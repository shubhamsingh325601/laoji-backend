import type { PushMessage } from '../../notification.types';
export declare function categorySuggestionApprovedVendorPush(categoryName: string): PushMessage;
export declare function categorySuggestionRejectedVendorPush(categoryName: string): PushMessage;
export declare function categorySuggestionCreatedAdminPush(categoryName: string, businessType?: string, vendorName?: string): PushMessage;
