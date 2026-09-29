import { OrderService } from './order.service';
import { orderConfirmedCustomerPush } from '../notification/templates/push/order-confirmed';
import { outForDeliveryCustomerPush } from '../notification/templates/push/out-for-delivery';
import { deliveredCustomerPush } from '../notification/templates/push/delivered';

describe('Order Lifecycle & Idempotency Audit', () => {
  let orderService: OrderService;
  let mockDb: any;
  let mockAllocation: any;
  let mockCatalog: any;
  let mockDelivery: any;
  let mockPayments: any;
  let mockNotifications: any;
  let mockRevenueConfig: any;
  let mockCoupons: any;

  const customerId = 'cust-uuid-1111';
  const restaurantId = 'rest-uuid-2222';
  const vendorId = 'vend-uuid-3333';
  const addressId = 'addr-uuid-4444';
  const menuItemId = 'item-uuid-5555';

  const sampleFoodDto = {
    restaurantId,
    deliveryAddressId: addressId,
    items: [{ menuItemId, qty: 1 }],
    instructions: 'No onions',
    couponCode: '',
    idempotencyKey: 'checkout-key-abc-123',
  };

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    mockAllocation = {
      findBestVendor: jest.fn(),
      createAttempt: jest.fn(),
      handleAcceptance: jest.fn(),
      handleRejection: jest.fn(),
    };
    mockCatalog = {
      customerCategoryId: jest.fn(),
      getVendorByUserId: jest.fn(),
      requireVendor: jest.fn(),
      getOrCreateRestaurant: jest.fn(),
      recalcRestaurantRating: jest.fn(),
    };
    mockDelivery = {
      triggerAssignment: jest.fn(),
    };
    mockPayments = {
      onPaymentSatisfied: { subscribe: jest.fn() },
      isSatisfied: jest.fn().mockReturnValue(true),
      markRefundPendingIfPaid: jest.fn(),
      markCodCollected: jest.fn(),
    };
    mockNotifications = {
      notifyPush: jest.fn(),
      notifyEmail: jest.fn(),
    };
    mockRevenueConfig = {
      resolve: jest.fn().mockResolvedValue({ commissionPct: 0.1, minOrderValue: 50, freeDeliveryThreshold: 200 }),
      calculateDeliveryFee: jest.fn().mockReturnValue(15),
    };
    mockCoupons = {
      evaluate: jest.fn().mockResolvedValue(null),
      findAutoApply: jest.fn().mockResolvedValue(null),
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
    );
  });

  describe('Order Creation Idempotency & Concurrency Safety', () => {
    it('returns the existing order when identical idempotencyKey is submitted twice', async () => {
      const existingOrderId = 'ord-permanent-uuid-777';
      const existingOrder = {
        id: existingOrderId,
        customerId,
        idempotencyKey: 'checkout-key-abc-123',
        restaurantId,
        deliveryAddressId: addressId,
        status: 'placed',
        subtotal: 50,
        deliveryFee: 15,
        total: 65,
        paymentStatus: 'pending',
        createdAt: new Date(),
      };

      // Mock select to find existing order on second request
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingOrder]),
          }),
        }),
      });

      // Spy on getFoodOrder
      const getFoodOrderSpy = jest.spyOn(orderService, 'getFoodOrder').mockResolvedValue(existingOrder as any);

      const result = await orderService.createFoodOrder(customerId, sampleFoodDto);

      expect(getFoodOrderSpy).toHaveBeenCalledWith(existingOrderId, { userId: customerId, role: 'customer' });
      expect(result.id).toBe(existingOrderId);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('recovers gracefully from unique constraint violation during concurrent race conditions', async () => {
      const canonicalOrderId = 'ord-race-winner-888';
      const canonicalOrder = {
        id: canonicalOrderId,
        customerId,
        idempotencyKey: 'checkout-key-abc-123',
        restaurantId,
        deliveryAddressId: addressId,
        status: 'placed',
        subtotal: 50,
        deliveryFee: 15,
        total: 65,
        paymentStatus: 'pending',
        createdAt: new Date(),
      };

      // 1. First select (idempotency pre-check) returns empty (both requests checked simultaneously)
      // 2. Price cart queries addresses, restaurant, vendor, items, categories
      // 3. Insert throws 23505 unique index violation
      // 4. Catch block queries existing and returns it
      let selectCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockImplementation(() => {
            selectCount++;
            const whereObj: any = Promise.resolve([{ id: menuItemId, menuCategoryId: 'cat-1', name: 'Burger', price: 50, isAvailable: true, mealSlots: null }]);
            whereObj.limit = jest.fn().mockImplementation(() => {
              if (selectCount === 1) return Promise.resolve([]); // initial idempotency check
              if (selectCount >= 2) return Promise.resolve([canonicalOrder]); // catch block query
              return Promise.resolve([]);
            });
            whereObj.orderBy = jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            });
            return whereObj;
          }),
        }),
      }));

      // Mock priceFoodCart internal queries
      jest.spyOn<any, any>(orderService, 'priceFoodCart').mockResolvedValue({
        revenue: { commissionPct: 0.1, minOrderValue: 50, freeDeliveryThreshold: 200 },
        orderItemRows: [{ menuItemId, qty: 1, unitPrice: 50, addonsJson: null }],
        pricing: { subtotal: 50, distanceKm: 1, deliveryFee: 15, discount: 0, total: 65, minOrderValue: 50, freeDeliveryThreshold: 200, coupon: null },
      });

      // Insert throws Postgres unique constraint error (code 23505)
      mockDb.insert.mockImplementation(() => {
        const err: any = new Error('duplicate key value violates unique constraint "food_orders_customer_idempotency_idx"');
        err.code = '23505';
        throw err;
      });

      jest.spyOn(orderService, 'getFoodOrder').mockResolvedValue(canonicalOrder as any);

      const result = await orderService.createFoodOrder(customerId, sampleFoodDto);

      expect(result.id).toBe(canonicalOrderId);
    });

    it('protects against duplicate submission within 5 seconds even if idempotencyKey was omitted', async () => {
      const recentOrderId = 'ord-recent-placed-999';
      const recentOrder = {
        id: recentOrderId,
        customerId,
        restaurantId,
        deliveryAddressId: addressId,
        status: 'placed',
        subtotal: 50,
        deliveryFee: 15,
        total: 65,
        createdAt: new Date(),
      };

      // Mock select for recent placed orders
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([recentOrder]),
            }),
          }),
        }),
      });

      const getFoodOrderSpy = jest.spyOn(orderService, 'getFoodOrder').mockResolvedValue(recentOrder as any);

      const dtoWithoutKey = { ...sampleFoodDto, idempotencyKey: undefined };
      const result = await orderService.createFoodOrder(customerId, dtoWithoutKey as any);

      expect(result.id).toBe(recentOrderId);
      expect(getFoodOrderSpy).toHaveBeenCalledWith(recentOrderId, { userId: customerId, role: 'customer' });
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('Status Transition Order ID Preservation', () => {
    it('vendor advance transitions UPDATE the existing order and preserve the permanent order ID', async () => {
      const orderId = 'ORD-PERMANENT-123';
      const existingOrder = {
        id: orderId,
        restaurantId,
        status: 'vendor_accepted',
        customerId,
      };

      jest.spyOn<any, any>(orderService, 'requireOwnFoodOrder').mockResolvedValue(existingOrder);
      mockCatalog.requireVendor.mockResolvedValue({ id: vendorId, userId: 'vendor-user-1' });
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: orderId, status: 'preparing' }]),
        }),
      });
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue([]),
      });
      jest.spyOn(orderService, 'getFoodOrder').mockResolvedValue({ ...existingOrder, status: 'preparing' } as any);

      const updated = await orderService.advanceFoodOrder('vendor-user-1', orderId, { status: 'preparing' as any });

      expect(updated.id).toBe(orderId);
      expect(mockDb.update).toHaveBeenCalled();
      // Ensure the only insert called was for orderStatusHistory, never for foodOrders
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('Notifications reference the SAME canonical Order ID', () => {
    it('order_confirmed notification includes the exact same orderId and orderCode', () => {
      const orderId = '77a07a70-a50e-4a04-bbe6-a06bcd476996';
      const orderCode = '77A07A70';
      const push = orderConfirmedCustomerPush(orderCode, orderId, 'food');

      expect(push.data.orderId).toBe(orderId);
      expect(push.data.orderCode).toBe(orderCode);
      expect(push.data.link).toBe(`/order/${orderId}?type=food`);
    });

    it('out_for_delivery notification includes the exact same orderId and orderCode', () => {
      const orderId = '77a07a70-a50e-4a04-bbe6-a06bcd476996';
      const orderCode = '77A07A70';
      const push = outForDeliveryCustomerPush(orderCode, orderId, 'food');

      expect(push.data.orderId).toBe(orderId);
      expect(push.data.orderCode).toBe(orderCode);
      expect(push.data.link).toBe(`/order/${orderId}?type=food`);
    });

    it('delivered notification includes the exact same orderId and orderCode', () => {
      const orderId = '77a07a70-a50e-4a04-bbe6-a06bcd476996';
      const orderCode = '77A07A70';
      const push = deliveredCustomerPush(orderCode, orderId, 'food');

      expect(push.data.orderId).toBe(orderId);
      expect(push.data.orderCode).toBe(orderCode);
      expect(push.data.link).toBe(`/order/${orderId}?type=food`);
    });
  });
});
