import { NotificationService } from './notification.service';
import { orderPlacedAdminPush } from './templates/push/order-placed';
import { orderCancelledAdminPush } from './templates/push/order-cancelled';
import { deliveredAdminPush } from './templates/push/delivered';
import { withdrawalRequestedAdminPush } from './templates/push/vendor-withdrawal';
import { vendorRegisteredAdminPush, kycSubmittedAdminPush } from './templates/push/vendor-onboarding';
import { categorySuggestionCreatedAdminPush } from './templates/push/category-suggestion';
import { productSuggestionCreatedAdminPush } from './templates/push/product-suggestion';

describe('Admin Push Notification Templates and Routing', () => {
  describe('Template Payloads and Deep Links', () => {
    it('generates orderPlacedAdminPush with deep link and formatted content', () => {
      const push = orderPlacedAdminPush('ORD12345', 450, 'grocery', 'ord_uuid_1', 'John Doe');
      expect(push.title).toContain('New Grocery Order #ORD12345');
      expect(push.body).toContain('John Doe');
      expect(push.body).toContain('₹450');
      expect(push.data?.event).toBe('order_placed');
      expect(push.data?.orderCode).toBe('ORD12345');
      expect(push.data?.total).toBe('450');
      expect(push.data?.link).toBe('/orders/ord_uuid_1');
      expect(push.data?.url).toBe('/orders/ord_uuid_1');
    });

    it('generates orderCancelledAdminPush with cancellation actor and link', () => {
      const push = orderCancelledAdminPush('ORD99999', 'ord_uuid_2', 'food', 'vendor');
      expect(push.title).toContain('Food Order Cancelled #ORD99999');
      expect(push.body).toContain('cancelled (vendor)');
      expect(push.data?.event).toBe('order_cancelled');
      expect(push.data?.link).toBe('/orders/ord_uuid_2');
      expect(push.data?.url).toBe('/orders/ord_uuid_2');
    });

    it('generates deliveredAdminPush with amount and deep link', () => {
      const push = deliveredAdminPush('ORD88888', 'ord_uuid_3', 'grocery', 780);
      expect(push.title).toContain('Grocery Order Delivered #ORD88888');
      expect(push.body).toContain('₹780');
      expect(push.data?.event).toBe('delivered');
      expect(push.data?.link).toBe('/orders/ord_uuid_3');
      expect(push.data?.url).toBe('/orders/ord_uuid_3');
    });

    it('generates withdrawalRequestedAdminPush with withdrawal ID and route', () => {
      const push = withdrawalRequestedAdminPush('Sangod Sweets', 2500, 'with_req_100');
      expect(push.title).toContain('New Withdrawal Request');
      expect(push.body).toContain('Sangod Sweets');
      expect(push.body).toContain('₹2500');
      expect(push.data?.event).toBe('withdrawal_requested');
      expect(push.data?.amount).toBe('2500');
      expect(push.data?.link).toBe('/withdrawals/with_req_100');
      expect(push.data?.url).toBe('/withdrawals/with_req_100');
    });

    it('generates vendorRegisteredAdminPush with profile link', () => {
      const push = vendorRegisteredAdminPush('Sharma Kirana', 'Ramesh Sharma', 'vend_55');
      expect(push.title).toContain('New Vendor Registered');
      expect(push.body).toContain('Sharma Kirana (Ramesh Sharma)');
      expect(push.data?.event).toBe('vendor_registered');
      expect(push.data?.link).toBe('/vendors/vend_55');
      expect(push.data?.url).toBe('/vendors/vend_55');
    });

    it('generates kycSubmittedAdminPush linking to KYC review', () => {
      const push = kycSubmittedAdminPush('Ramesh Sharma', 'vendor', 'aadhaar_front');
      expect(push.title).toContain('New KYC Document Submitted');
      expect(push.body).toContain('Vendor "Ramesh Sharma"');
      expect(push.body).toContain('aadhaar front');
      expect(push.data?.event).toBe('kyc_submitted');
      expect(push.data?.link).toBe('/kyc-review');
      expect(push.data?.url).toBe('/kyc-review');
    });

    it('generates categorySuggestionCreatedAdminPush linking to Catalog', () => {
      const push = categorySuggestionCreatedAdminPush('Organic Pulses', 'grocery', 'Gupta Traders');
      expect(push.title).toContain('New Category Suggestion');
      expect(push.body).toContain('Organic Pulses');
      expect(push.body).toContain('Gupta Traders');
      expect(push.data?.event).toBe('category_suggestion');
      expect(push.data?.link).toBe('/catalog');
      expect(push.data?.url).toBe('/catalog');
    });

    it('generates productSuggestionCreatedAdminPush linking to Product Suggestions', () => {
      const push = productSuggestionCreatedAdminPush('Desi Ghee 1L', 'Dairy', 'Verma Store');
      expect(push.title).toContain('New Product Suggestion');
      expect(push.body).toContain('Desi Ghee 1L');
      expect(push.body).toContain('Dairy');
      expect(push.body).toContain('Verma Store');
      expect(push.data?.event).toBe('product_suggestion');
      expect(push.data?.link).toBe('/product-suggestions');
      expect(push.data?.url).toBe('/product-suggestions');
    });
  });

  describe('NotificationService Admin Dispatching', () => {
    let mockDb: any;
    let mockJobQueue: any;
    let mockPush: any;
    let mockEmail: any;
    let notificationService: NotificationService;

    beforeEach(() => {
      mockDb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };
      mockJobQueue = {
        schedule: jest.fn().mockImplementation((_jobId, _delay, fn) => fn()),
      };
      mockPush = {
        send: jest.fn().mockResolvedValue({ ok: true, stubbed: false }),
      };
      mockEmail = {
        send: jest.fn().mockResolvedValue({ ok: true }),
      };
      notificationService = new NotificationService(mockDb, mockJobQueue, mockPush, mockEmail);
    });

    it('notifies all admin users with role="admin"', async () => {
      const adminUsers = [
        { id: 'admin_1', role: 'admin', email: 'admin1@laoji.in' },
        { id: 'admin_2', role: 'admin', email: 'admin2@laoji.in' },
      ];
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve(adminUsers),
        }),
      }));

      const notifyPushSpy = jest.spyOn(notificationService, 'notifyPush');

      await notificationService.notifyAllAdminsPush('order_placed', {
        title: '🛍️ New Order',
        body: 'Amount: ₹500',
      });

      expect(notifyPushSpy).toHaveBeenCalledTimes(2);
      expect(notifyPushSpy).toHaveBeenCalledWith('admin_1', 'order_placed', expect.anything());
      expect(notifyPushSpy).toHaveBeenCalledWith('admin_2', 'order_placed', expect.anything());
    });

    it('registers and unregisters web device tokens for authenticated admins', async () => {
      // Register
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }));
      mockDb.insert.mockImplementation(() => ({
        values: () => ({
          returning: () => Promise.resolve([{ id: 'tok_1', userId: 'admin_1', fcmToken: 'web_token_abc', platform: 'web' }]),
        }),
      }));

      const registered = await notificationService.registerDeviceToken('admin_1', 'web_token_abc', 'web');
      expect(registered).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();

      // Unregister
      await notificationService.unregisterDeviceToken('admin_1', 'web_token_abc');
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('prunes dead device tokens when FCM reports token is invalid', async () => {
      const tokens = [
        { id: 'tok_active', userId: 'admin_1', fcmToken: 'active_token', platform: 'web' },
        { id: 'tok_dead', userId: 'admin_1', fcmToken: 'stale_dead_token', platform: 'web' },
      ];

      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve(tokens),
        }),
      }));

      mockPush.send.mockImplementation((token: string) => {
        if (token === 'stale_dead_token') {
          return Promise.resolve({ ok: false, invalidToken: true, error: 'Registration token not registered' });
        }
        return Promise.resolve({ ok: true, stubbed: false });
      });

      await (notificationService as any).dispatchPush('admin_1', 'order_placed', {
        title: 'Test',
        body: 'Test body',
      });

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
