import type { PushMessage } from '../../notification.types';
export declare function vendorRegisteredAdminPush(businessName: string, ownerName?: string, vendorId?: string): PushMessage;
export declare function kycSubmittedAdminPush(userName: string, role: string, docType: string): PushMessage;
