import { OrderService } from './order.service';
import {
  users,
  vendors,
  addresses,
  deliveryPartners,
  restaurants,
  groceryOrders,
  foodOrders,
  allocationAttempts,
  orderStatusHistory,
} from '../../../drizzle/schema';

describe('Admin Order Actions (Accept & Restore)', () => {
  let orderService: OrderService;
  let mockDb: any;
  let mockAllocation: any;
  let mockCatalog: any;
  let mockDelivery: any;
  let mockPayments: any;
  let mockNotifications: any;
  let mockRevenueConfig: any;
  let mockCoupons: any;
  let mockVendorDiscounts: any;
  let mockWallet: any;

  const adminUserId = 'admin-uuid-0000';
  const customerId = 'cust-uuid-1111';
  const vendorUserId = 'vend-user-uuid-2222';
  const vendorId = 'vend-uuid-3333';
  const restaurantId = 'rest-uuid-4444';
  const addressId = 'addr-uuid-5555';
  const groceryOrderId = 'ord-groc-uuid-6666';
  const foodOrderId = 'ord-food-uuid-7777';

  const mockCustomerUser = {
    id: customerId,
    name: 'Pooja Verma',
    phone: '+919876543210',
    role: 'customer',
  };

  const mockAddress = {
    id: addressId,
    formattedAddress: '45 Lake View, Sangod, Rajasthan',
  };

  const mockGroceryOrder = {
    id: groceryOrderId,
    customerId,
    vendorId,
    deliveryAddressId: addressId,
    deliveryPartnerId: null as string | null,
    status: 'placed',
    subtotal: 180,
    deliveryFee: 15,
    total: 195,
    paymentStatus: 'paid',
    deliveryOtp: '123456',
    createdAt: new Date(),
  };

  const mockFoodOrder = {
    id: foodOrderId,
    customerId,
    restaurantId,
    deliveryAddressId: addressId,
    deliveryPartnerId: null as string | null,
    status: 'placed',
    subtotal: 220,
    deliveryFee: 20,
    total: 240,
    paymentStatus: 'paid',
    deliveryOtp: '654321',
    createdAt: new Date(),
  };

  const mockRestaurantRow = {
    id: restaurantId,
    vendorId,
    name: 'Sangod Food Corner',
  };

  const mockVendorRow = {
    id: vendorId,
    userId: vendorUserId,
    businessName: 'Sangod Daily Mart',
  };

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue([]),
      }),
      update: jest.fn(),
    };
    mockAllocation = {
      findBestVendor: jest.fn(),
      createAttempt: jest.fn().mockResolvedValue({ id: 'att-1' }),
      handleAcceptance: jest.fn().mockResolvedValue(true),
      handleRejection: jest.fn(),
    };
    mockCatalog = {
      getVendorByUserId: jest.fn().mockResolvedValue(mockVendorRow),
      requireVendor: jest.fn().mockResolvedValue(mockVendorRow),
      getOrCreateRestaurant: jest.fn().mockResolvedValue(mockRestaurantRow),
      recalcRestaurantRating: jest.fn(),
    };
    mockDelivery = {
      triggerAssignment: jest.fn(),
    };
    mockPayments = {
      onPaymentSatisfied: { subscribe: jest.fn() },
      isSatisfied: jest.fn().mockImplementation((status: string) => ['paid', 'pending_cod', 'collected'].includes(status)),
      markRefundPendingIfPaid: jest.fn(),
      restorePaymentStatusIfRestored: jest.fn().mockResolvedValue(undefined),
    };

    mockNotifications = {
      notifyPush: jest.fn(),
      notifyEmail: jest.fn(),
    };
    mockRevenueConfig = {
      resolve: jest.fn().mockResolvedValue({ commissionPct: 0.1, minOrderValue: 50, freeDeliveryThreshold: 200 }),
    };
    mockCoupons = {
      evaluate: jest.fn().mockResolvedValue(null),
    };
    mockVendorDiscounts = {
      getActiveDiscountsForVendor: jest.fn().mockResolvedValue([]),
    };
    mockWallet = {
      cancelPendingCommission: jest.fn(),
      restorePendingCommission: jest.fn().mockResolvedValue(undefined),
    };

    orderService = new OrderService(
      mockDb,
      mockAllocation,
      mockCatalog,
      mockDelivery,
      mockPayments,
      mockNotifications,
      mockRevenueConfig,
      mockCoupons,
      mockVendorDiscounts,
      mockWallet,
    );
  });

  const setupMockDb = (options: { order: any; attempt?: any }) => {
    mockDb.select.mockImplementation(() => {
      let currentTable: any = null;
      const chain: any = {
        from: jest.fn().mockImplementation((table: any) => {
          currentTable = table;
          return chain;
        }),
        where: jest.fn().mockImplementation(() => {
          return chain;
        }),
        orderBy: jest.fn().mockImplementation(() => {
          return Promise.resolve([]);
        }),
        limit: jest.fn().mockImplementation((n: number) => {
          if (currentTable === restaurants) {
            return Promise.resolve([mockRestaurantRow]);
          }
          if (currentTable === vendors) {
            return Promise.resolve([mockVendorRow]);
          }
          if (currentTable === addresses) {
            return Promise.resolve([mockAddress]);
          }
          if (currentTable === users) {
            return Promise.resolve([mockCustomerUser]);
          }
          if (currentTable === allocationAttempts) {
            return Promise.resolve(options.attempt ? [options.attempt] : []);
          }
          if (currentTable === groceryOrders || currentTable === foodOrders) {
            return Promise.resolve([options.order]);
          }
          return Promise.resolve([]);
        }),
        then: (resolve: any) => {
          if (currentTable === users) {
            resolve([mockCustomerUser, { id: vendorUserId, role: 'vendor', name: 'Vendor Owner' }]);
          } else {
            resolve([]);
          }
        },
      };
      return chain;
    });

    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ ...options.order, status: 'vendor_accepted' }]),
        }),
      }),
    });
  };

  describe('Admin Accept Order', () => {
    it('accepts a placed grocery order on behalf of the vendor and sends notifications', async () => {
      const order = { ...mockGroceryOrder, status: 'placed', paymentStatus: 'paid' };
      const attempt = { id: 'att-pending-1', groceryOrderId, outcome: 'pending' };
      setupMockDb({ order, attempt });

      const result = await orderService.acceptOrderByAdmin(adminUserId, 'grocery', groceryOrderId);

      // Verify allocation was marked accepted
      expect(mockAllocation.handleAcceptance).toHaveBeenCalledWith('att-pending-1');
      // Verify database update was called with vendor_accepted
      expect(mockDb.update).toHaveBeenCalled();
      // Verify timeline history inserted with actorRole: admin
      expect(mockDb.insert).toHaveBeenCalled();
      // Verify customer and vendor push notifications sent
      expect(mockNotifications.notifyPush).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('accepts a placed food order on behalf of the restaurant and sends notifications', async () => {
      const order = { ...mockFoodOrder, status: 'placed', paymentStatus: 'paid' };
      setupMockDb({ order });

      const result = await orderService.acceptOrderByAdmin(adminUserId, 'food', foodOrderId);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockNotifications.notifyPush).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('throws error when trying to accept an order that is already accepted', async () => {
      const order = { ...mockGroceryOrder, status: 'vendor_accepted' };
      setupMockDb({ order });

      await expect(
        orderService.acceptOrderByAdmin(adminUserId, 'grocery', groceryOrderId),
      ).rejects.toThrow('Order has already been accepted');
    });

    it('throws error when trying to accept an order with unsatisfied payment (e.g. refunded or pending)', async () => {
      const order = { ...mockGroceryOrder, status: 'placed', paymentStatus: 'refunded' };
      setupMockDb({ order });

      await expect(
        orderService.acceptOrderByAdmin(adminUserId, 'grocery', groceryOrderId),
      ).rejects.toThrow('Payment has not been confirmed for this order yet');
    });

    it('preserves vendor open/closed status intact (Scenario 1 & 2: does NOT modify vendor or restaurant table)', async () => {
      const order = { ...mockGroceryOrder, status: 'placed', paymentStatus: 'paid' };
      const attempt = { id: 'att-pending-1', groceryOrderId, outcome: 'pending' };
      setupMockDb({ order, attempt });

      const updatedTables: any[] = [];
      mockDb.update.mockImplementation((table: any) => {
        updatedTables.push(table);
        return {
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{ ...order, status: 'vendor_accepted' }]),
            }),
          }),
        };
      });

      await orderService.acceptOrderByAdmin(adminUserId, 'grocery', groceryOrderId);

      // Verify that vendors and restaurants tables were NEVER updated
      expect(updatedTables).not.toContain(vendors);
      expect(updatedTables).not.toContain(restaurants);
      expect(updatedTables).toContain(groceryOrders);
    });
  });

  describe('Admin Restore Order (On Behalf of Customer)', () => {
    it('restores a cancelled grocery order back to placed status and re-creates allocation attempt', async () => {
      const order = { ...mockGroceryOrder, status: 'cancelled', paymentStatus: 'refund_pending' };
      setupMockDb({ order });

      let updatedValues: any = null;
      mockDb.update.mockReturnValue({
        set: jest.fn().mockImplementation((val) => {
          updatedValues = val;
          return {
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{ ...order, ...val }]),
            }),
          };
        }),
      });

      const result = await orderService.restoreOrder(adminUserId, 'grocery', groceryOrderId);

      // Verify payment refund restoration was called
      expect(mockPayments.restorePaymentStatusIfRestored).toHaveBeenCalledWith('grocery', groceryOrderId);
      // Verify affiliate commission was restored
      expect(mockWallet.restorePendingCommission).toHaveBeenCalledWith('grocery', groceryOrderId);
      // Verify allocation attempt was re-created
      expect(mockAllocation.createAttempt).toHaveBeenCalledWith(groceryOrderId, vendorId, 1);
      // Verify status set to placed and paymentStatus to paid
      expect(updatedValues.status).toBe('placed');
      expect(updatedValues.paymentStatus).toBe('paid');
      // Verify notifications sent
      expect(mockNotifications.notifyPush).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('restores an already refunded order without blindly marking payment as paid', async () => {
      const order = { ...mockGroceryOrder, status: 'cancelled', paymentStatus: 'refunded' };
      setupMockDb({ order });

      let updatedValues: any = null;
      mockDb.update.mockReturnValue({
        set: jest.fn().mockImplementation((val) => {
          updatedValues = val;
          return {
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{ ...order, ...val }]),
            }),
          };
        }),
      });

      const result = await orderService.restoreOrder(adminUserId, 'grocery', groceryOrderId);

      expect(mockPayments.restorePaymentStatusIfRestored).toHaveBeenCalledWith('grocery', groceryOrderId);
      // Must NOT be marked as paid
      expect(updatedValues.paymentStatus).toBe('refunded');
      expect(updatedValues.status).toBe('placed');
      expect(result).toBeDefined();
    });

    it('restores a cancelled food order back to placed status', async () => {
      const order = { ...mockFoodOrder, status: 'cancelled', paymentStatus: 'paid' };
      setupMockDb({ order });

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ ...order, status: 'placed', paymentStatus: 'paid' }]),
          }),
        }),
      });

      const result = await orderService.restoreOrder(adminUserId, 'food', foodOrderId);

      expect(mockPayments.restorePaymentStatusIfRestored).toHaveBeenCalledWith('food', foodOrderId);
      expect(mockNotifications.notifyPush).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws error if order is not cancelled or failed', async () => {
      const order = { ...mockGroceryOrder, status: 'vendor_accepted' };
      setupMockDb({ order });

      await expect(
        orderService.restoreOrder(adminUserId, 'grocery', groceryOrderId),
      ).rejects.toThrow('Only cancelled or failed orders can be restored');
    });
  });

  describe('Admin Change Order Vendor / Store', () => {
    const newVendorId = 'new-vend-uuid-9999';
    const newVendorRow = {
      id: newVendorId,
      userId: 'new-vend-user-9999',
      businessName: 'Sangod Supermart',
    };

    const newRestaurantId = 'new-rest-uuid-8888';
    const newRestaurantRow = {
      id: newRestaurantId,
      vendorId: newVendorId,
      name: 'Sangod Royal Dine',
    };

    it('changes vendor for a grocery order, creates new allocation attempt, and notifies parties', async () => {
      const order = { ...mockGroceryOrder, status: 'placed', vendorId };
      const attempt = { id: 'att-old-1', groceryOrderId, outcome: 'pending' };
      setupMockDb({ order, attempt });

      // Mock selecting new vendor
      const origSelect = mockDb.select;
      mockDb.select.mockImplementation(() => {
        let currentTable: any = null;
        const chain: any = {
          from: jest.fn().mockImplementation((table: any) => {
            currentTable = table;
            return chain;
          }),
          where: jest.fn().mockImplementation(() => chain),
          orderBy: jest.fn().mockImplementation(() => Promise.resolve([])),
          limit: jest.fn().mockImplementation(() => {
            if (currentTable === vendors) {
              return Promise.resolve([newVendorRow]);
            }
            if (currentTable === allocationAttempts) {
              return Promise.resolve([attempt]);
            }
            if (currentTable === groceryOrders) {
              return Promise.resolve([order]);
            }
            if (currentTable === addresses) {
              return Promise.resolve([mockAddress]);
            }
            if (currentTable === users) {
              return Promise.resolve([mockCustomerUser]);
            }
            return Promise.resolve([]);
          }),
          then: (resolve: any) => resolve([]),
        };
        return chain;
      });

      let updatedValues: any = null;
      mockDb.update.mockImplementation((table: any) => ({
        set: jest.fn().mockImplementation((val) => {
          if (table === groceryOrders) updatedValues = val;
          return {
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{ ...order, ...val }]),
            }),
          };
        }),
      }));

      const result = await orderService.changeOrderVendor(adminUserId, 'grocery', groceryOrderId, {
        vendorId: newVendorId,
      });

      expect(mockAllocation.handleRejection).toHaveBeenCalledWith('att-old-1');
      expect(mockAllocation.createAttempt).toHaveBeenCalledWith(groceryOrderId, newVendorId, 1);
      expect(updatedValues.vendorId).toBe(newVendorId);
      expect(updatedValues.status).toBe('placed');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockNotifications.notifyPush).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('changes restaurant for a food order and sends notifications', async () => {
      const order = { ...mockFoodOrder, status: 'placed', restaurantId };
      setupMockDb({ order });

      mockDb.select.mockImplementation(() => {
        let currentTable: any = null;
        const chain: any = {
          from: jest.fn().mockImplementation((table: any) => {
            currentTable = table;
            return chain;
          }),
          where: jest.fn().mockImplementation(() => chain),
          orderBy: jest.fn().mockImplementation(() => Promise.resolve([])),
          limit: jest.fn().mockImplementation(() => {
            if (currentTable === restaurants) {
              return Promise.resolve([newRestaurantRow]);
            }
            if (currentTable === vendors) {
              return Promise.resolve([newVendorRow]);
            }
            if (currentTable === foodOrders) {
              return Promise.resolve([order]);
            }
            if (currentTable === addresses) {
              return Promise.resolve([mockAddress]);
            }
            if (currentTable === users) {
              return Promise.resolve([mockCustomerUser]);
            }
            return Promise.resolve([]);
          }),
          then: (resolve: any) => resolve([]),
        };
        return chain;
      });

      let updatedValues: any = null;
      mockDb.update.mockImplementation((table: any) => ({
        set: jest.fn().mockImplementation((val) => {
          if (table === foodOrders) updatedValues = val;
          return {
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{ ...order, ...val }]),
            }),
          };
        }),
      }));

      const result = await orderService.changeOrderVendor(adminUserId, 'food', foodOrderId, {
        restaurantId: newRestaurantId,
      });

      expect(updatedValues.restaurantId).toBe(newRestaurantId);
      expect(updatedValues.status).toBe('placed');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockNotifications.notifyPush).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('changes vendor when order was already accepted/handed_over, detaches delivery partner, and resets to placed', async () => {
      const deliveryPartnerId = 'dp-uuid-1111';
      const order = {
        ...mockGroceryOrder,
        status: 'handed_over',
        vendorId,
        deliveryPartnerId,
      };
      setupMockDb({ order });

      mockDb.select.mockImplementation(() => {
        let currentTable: any = null;
        const chain: any = {
          from: jest.fn().mockImplementation((table: any) => {
            currentTable = table;
            return chain;
          }),
          where: jest.fn().mockImplementation(() => chain),
          orderBy: jest.fn().mockImplementation(() => Promise.resolve([])),
          limit: jest.fn().mockImplementation(() => {
            if (currentTable === vendors) {
              return Promise.resolve([newVendorRow]);
            }
            if (currentTable === deliveryPartners) {
              return Promise.resolve([{ id: deliveryPartnerId, userId: 'dp-user-1111' }]);
            }
            if (currentTable === allocationAttempts) {
              return Promise.resolve([]);
            }
            if (currentTable === groceryOrders) {
              return Promise.resolve([order]);
            }
            if (currentTable === addresses) {
              return Promise.resolve([mockAddress]);
            }
            if (currentTable === users) {
              return Promise.resolve([mockCustomerUser]);
            }
            return Promise.resolve([]);
          }),
          then: (resolve: any) => resolve([]),
        };
        return chain;
      });

      let updatedValues: any = null;
      mockDb.update.mockImplementation((table: any) => ({
        set: jest.fn().mockImplementation((val) => {
          if (table === groceryOrders) updatedValues = val;
          return {
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{ ...order, ...val }]),
            }),
          };
        }),
      }));

      const result = await orderService.changeOrderVendor(adminUserId, 'grocery', groceryOrderId, {
        vendorId: newVendorId,
      });

      expect(updatedValues.vendorId).toBe(newVendorId);
      expect(updatedValues.status).toBe('placed');
      expect(updatedValues.deliveryPartnerId).toBeNull();
      expect(mockAllocation.createAttempt).toHaveBeenCalledWith(groceryOrderId, newVendorId, 1);
      // Partner notified of cancelled pickup
      expect(mockNotifications.notifyPush).toHaveBeenCalledWith(
        'dp-user-1111',
        'order_cancelled',
        expect.objectContaining({ title: 'Order Reassigned' }),
      );
      expect(result).toBeDefined();
    });

    it('throws error when trying to change vendor on a delivered order', async () => {
      const order = { ...mockGroceryOrder, status: 'delivered' };
      setupMockDb({ order });

      await expect(
        orderService.changeOrderVendor(adminUserId, 'grocery', groceryOrderId, { vendorId: newVendorId }),
      ).rejects.toThrow('Cannot change vendor for a completed/delivered order');
    });

    it('throws error when trying to change vendor on a picked_up / out_for_delivery order', async () => {
      const order = { ...mockGroceryOrder, status: 'picked_up' };
      setupMockDb({ order });

      await expect(
        orderService.changeOrderVendor(adminUserId, 'grocery', groceryOrderId, { vendorId: newVendorId }),
      ).rejects.toThrow('Cannot change vendor once order is in physical delivery transit');
    });

    it('throws error when trying to change vendor on a cancelled / failed order without restoring first', async () => {
      const order = { ...mockGroceryOrder, status: 'cancelled' };
      setupMockDb({ order });

      await expect(
        orderService.changeOrderVendor(adminUserId, 'grocery', groceryOrderId, { vendorId: newVendorId }),
      ).rejects.toThrow('please restore the order first');
    });

    it('throws error when trying to reassign to the exact same vendor', async () => {
      const order = { ...mockGroceryOrder, status: 'placed', vendorId };
      setupMockDb({ order });

      mockDb.select.mockImplementation(() => {
        let currentTable: any = null;
        const chain: any = {
          from: jest.fn().mockImplementation((table: any) => {
            currentTable = table;
            return chain;
          }),
          where: jest.fn().mockImplementation(() => chain),
          orderBy: jest.fn().mockImplementation(() => Promise.resolve([])),
          limit: jest.fn().mockImplementation(() => {
            if (currentTable === vendors) {
              return Promise.resolve([mockVendorRow]);
            }
            if (currentTable === groceryOrders) {
              return Promise.resolve([order]);
            }
            return Promise.resolve([]);
          }),
          then: (resolve: any) => resolve([]),
        };
        return chain;
      });

      await expect(
        orderService.changeOrderVendor(adminUserId, 'grocery', groceryOrderId, { vendorId }),
      ).rejects.toThrow('Order is already assigned to this vendor');
    });
  });
});
