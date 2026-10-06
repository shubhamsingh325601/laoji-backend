import { OrderService } from './order.service';
import {
  users,
  addresses,
  deliveryPartners,
  restaurants,
  groceryOrders,
  foodOrders,
  groceryOrderItems,
  foodOrderItems,
  orderStatusHistory,
} from '../../../drizzle/schema';

describe('Vendor Customer Phone Privacy & Delivery Partner Exposure Audit', () => {
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

  const customerId = 'cust-uuid-1111';
  const customerUserId = customerId;
  const customerPhone = '+919999988888';
  const customerName = 'Aarav Sharma';

  const vendorUserId = 'vend-user-uuid-2222';
  const vendorId = 'vend-uuid-3333';

  const deliveryPartnerUserId = 'rider-user-uuid-4444';
  const deliveryPartnerId = 'rider-uuid-5555';
  const riderPhone = '+919876543210';
  const riderName = 'Ramesh Rider';

  const addressId = 'addr-uuid-6666';
  const groceryOrderId = 'ord-groc-uuid-7777';
  const foodOrderId = 'ord-food-uuid-8888';
  const restaurantId = 'rest-uuid-9999';

  const mockCustomerUser = {
    id: customerUserId,
    name: customerName,
    phone: customerPhone,
    role: 'customer',
  };

  const mockCustomerWithoutName = {
    id: customerUserId,
    name: null,
    phone: customerPhone,
    role: 'customer',
  };

  const mockAddress = {
    id: addressId,
    formattedAddress: '123 Main St, Sangod, Rajasthan',
  };

  const mockDeliveryPartnerRow = {
    id: deliveryPartnerId,
    userId: deliveryPartnerUserId,
    vehicleType: 'Electric Bike',
    isOnline: true,
  };

  const mockDeliveryPartnerUser = {
    id: deliveryPartnerUserId,
    name: riderName,
    phone: riderPhone,
    role: 'delivery_partner',
  };

  const mockGroceryOrderRow = {
    id: groceryOrderId,
    customerId,
    vendorId,
    deliveryAddressId: addressId,
    deliveryPartnerId: null as string | null,
    status: 'vendor_accepted',
    subtotal: 250,
    deliveryFee: 20,
    total: 270,
    paymentStatus: 'paid',
    deliveryOtp: '123456',
    createdAt: new Date(),
  };

  const mockFoodOrderRow = {
    id: foodOrderId,
    customerId,
    restaurantId,
    deliveryAddressId: addressId,
    deliveryPartnerId: null as string | null,
    status: 'vendor_accepted',
    subtotal: 300,
    deliveryFee: 25,
    total: 325,
    paymentStatus: 'paid',
    deliveryOtp: '654321',
    createdAt: new Date(),
  };

  const mockRestaurantRow = {
    id: restaurantId,
    vendorId,
    name: 'Sangod Royal Cafe',
  };

  const mockHistory = [
    {
      id: 'hist-1',
      groceryOrderId,
      foodOrderId: null,
      status: 'placed',
      actorRole: 'customer',
      changedBy: customerUserId,
      changedAt: new Date(),
    },
    {
      id: 'hist-2',
      groceryOrderId,
      foodOrderId: null,
      status: 'vendor_accepted',
      actorRole: 'vendor',
      changedBy: vendorUserId,
      changedAt: new Date(),
    },
  ];

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
      getVendorByUserId: jest.fn().mockResolvedValue({ id: vendorId, userId: vendorUserId }),
      requireVendor: jest.fn().mockResolvedValue({ id: vendorId, userId: vendorUserId }),
      getOrCreateRestaurant: jest.fn().mockResolvedValue({ id: restaurantId, vendorId }),
      recalcRestaurantRating: jest.fn(),
    };
    mockDelivery = {
      triggerAssignment: jest.fn(),
    };
    mockPayments = {
      onPaymentSatisfied: { subscribe: jest.fn() },
      isSatisfied: jest.fn().mockReturnValue(true),
      markRefundPendingIfPaid: jest.fn(),
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

  const setupMockDb = (options: {
    order: any;
    items?: any[];
    history?: any[];
    customerUser?: any;
    address?: any;
    deliveryPartnerRow?: any;
    deliveryPartnerUser?: any;
    restaurantRow?: any;
  }) => {
    let userQueryCount = 0;
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
          return Promise.resolve(options.history || mockHistory);
        }),
        limit: jest.fn().mockImplementation((n: number) => {
          if (currentTable === restaurants) {
            return Promise.resolve([options.restaurantRow || mockRestaurantRow]);
          }
          if (currentTable === deliveryPartners) {
            return Promise.resolve(options.deliveryPartnerRow ? [options.deliveryPartnerRow] : []);
          }
          if (currentTable === addresses) {
            return Promise.resolve([options.address || mockAddress]);
          }
          if (currentTable === users) {
            userQueryCount++;
            // Query 1 with limit(1) is for customerSummary
            // Query 2 with limit(1) is for getDeliveryPartnerSummary (partner user)
            if (options.deliveryPartnerUser && userQueryCount === 2) {
              return Promise.resolve([options.deliveryPartnerUser]);
            }
            return Promise.resolve([options.customerUser || mockCustomerUser]);
          }
          if (currentTable === groceryOrders || currentTable === foodOrders) {
            return Promise.resolve([options.order]);
          }
          return Promise.resolve([]);
        }),
        then: (resolve: any) => {
          if (currentTable === groceryOrderItems || currentTable === foodOrderItems) {
            resolve(options.items || []);
          } else if (currentTable === users) {
            resolve([
              options.customerUser || mockCustomerUser,
              ...(options.deliveryPartnerUser ? [options.deliveryPartnerUser] : []),
              { id: vendorUserId, name: 'Vendor Owner', phone: '+919111122222', role: 'vendor' },
            ]);
          } else if (currentTable === orderStatusHistory) {
            resolve(options.history || mockHistory);
          } else {
            resolve([]);
          }
        },
      };
      return chain;
    });
  };

  describe('Grocery Order Privacy for Vendors', () => {
    it('State 1: BEFORE delivery partner assignment — customer phone is redacted and deliveryPartner is null', async () => {
      const unassignedOrder = { ...mockGroceryOrderRow, deliveryPartnerId: null };

      setupMockDb({
        order: unassignedOrder,
        customerUser: mockCustomerUser,
        address: mockAddress,
        history: mockHistory,
      });

      const result = await orderService.getGroceryOrder(groceryOrderId, {
        userId: vendorUserId,
        role: 'vendor',
      });

      // 1. Customer phone is strictly empty string (never exposed)
      expect(result.customer.phone).toBe('');
      // 2. Customer personal details (name, address) are also redacted for vendor
      expect(result.customer.name).toBe('Customer');
      expect(result.customer.line1).toBe('');
      // 3. Delivery partner is null
      expect(result.deliveryPartner).toBeNull();
      // 4. Raw JSON does not contain customer's phone or address anywhere
      const jsonStr = JSON.stringify(result);
      expect(jsonStr).not.toContain(customerPhone);
      expect(jsonStr).not.toContain('123 Main St');
      // 5. Doorstep OTP is also hidden from vendor
      expect(result.deliveryOtp).toBeNull();
    });

    it('State 2: AFTER delivery partner assignment — customer phone remains redacted, delivery partner phone is exposed', async () => {
      const assignedOrder = { ...mockGroceryOrderRow, deliveryPartnerId };

      setupMockDb({
        order: assignedOrder,
        customerUser: mockCustomerUser,
        address: mockAddress,
        history: mockHistory,
        deliveryPartnerRow: mockDeliveryPartnerRow,
        deliveryPartnerUser: mockDeliveryPartnerUser,
      });

      const result = await orderService.getGroceryOrder(groceryOrderId, {
        userId: vendorUserId,
        role: 'vendor',
      });

      // 1. Customer phone is still empty string and customer name/address is redacted
      expect(result.customer.phone).toBe('');
      expect(result.customer.name).toBe('Customer');
      expect(result.customer.line1).toBe('');
      // 2. Delivery partner is populated
      expect(result.deliveryPartner).toBeDefined();
      expect(result.deliveryPartner).not.toBeNull();
      // 3. Delivery partner phone belongs to the rider
      expect(result.deliveryPartner!.phone).toBe(riderPhone);
      expect(result.deliveryPartner!.name).toBe(riderName);
      expect(result.deliveryPartner!.vehicleType).toBe('Electric Bike');
      // 4. Customer phone is NOT anywhere in the response
      const jsonStr = JSON.stringify(result);
      expect(jsonStr).not.toContain(customerPhone);
      expect(jsonStr).not.toContain('123 Main St');
      // 5. Rider phone IS present
      expect(jsonStr).toContain(riderPhone);
    });

    it('Customer without name falls back to "Customer", not customer phone', async () => {
      const unassignedOrder = { ...mockGroceryOrderRow, deliveryPartnerId: null };

      setupMockDb({
        order: unassignedOrder,
        customerUser: mockCustomerWithoutName,
        address: mockAddress,
        history: [],
      });

      const result = await orderService.getGroceryOrder(groceryOrderId, {
        userId: vendorUserId,
        role: 'vendor',
      });

      expect(result.customer.name).toBe('Customer');
      expect(result.customer.phone).toBe('');
      expect(result.customer.line1).toBe('');
      expect(JSON.stringify(result)).not.toContain(customerPhone);
    });
  });

  describe('Food Order Privacy for Vendors', () => {
    it('State 1: BEFORE delivery partner assignment — customer phone is redacted and deliveryPartner is null', async () => {
      const unassignedFood = { ...mockFoodOrderRow, deliveryPartnerId: null };

      setupMockDb({
        order: unassignedFood,
        restaurantRow: mockRestaurantRow,
        customerUser: mockCustomerUser,
        address: mockAddress,
        history: [],
      });

      const result = await orderService.getFoodOrder(foodOrderId, {
        userId: vendorUserId,
        role: 'vendor',
      });

      expect(result.customer.phone).toBe('');
      expect(result.customer.name).toBe('Customer');
      expect(result.customer.line1).toBe('');
      expect(result.deliveryPartner).toBeNull();
      expect(JSON.stringify(result)).not.toContain(customerPhone);
      expect(JSON.stringify(result)).not.toContain('123 Main St');
    });

    it('State 2: AFTER delivery partner assignment — customer phone redacted, delivery partner phone exposed', async () => {
      const assignedFood = { ...mockFoodOrderRow, deliveryPartnerId };

      setupMockDb({
        order: assignedFood,
        restaurantRow: mockRestaurantRow,
        customerUser: mockCustomerUser,
        address: mockAddress,
        history: [],
        deliveryPartnerRow: mockDeliveryPartnerRow,
        deliveryPartnerUser: mockDeliveryPartnerUser,
      });

      const result = await orderService.getFoodOrder(foodOrderId, {
        userId: vendorUserId,
        role: 'vendor',
      });

      expect(result.customer.phone).toBe('');
      expect(result.customer.name).toBe('Customer');
      expect(result.customer.line1).toBe('');
      expect(result.deliveryPartner).not.toBeNull();
      expect(result.deliveryPartner!.phone).toBe(riderPhone);
      expect(JSON.stringify(result)).not.toContain(customerPhone);
      expect(JSON.stringify(result)).not.toContain('123 Main St');
      expect(JSON.stringify(result)).toContain(riderPhone);
    });
  });

  describe('Regression Check: Customer and Admin Legitimately Receive Customer Contact', () => {
    it('Customer role CAN see their own phone number and delivery OTP', async () => {
      const order = { ...mockGroceryOrderRow, deliveryPartnerId: null };

      setupMockDb({
        order,
        customerUser: mockCustomerUser,
        address: mockAddress,
        history: [],
      });

      const result = await orderService.getGroceryOrder(groceryOrderId, {
        userId: customerUserId,
        role: 'customer',
      });

      expect(result.customer.phone).toBe(customerPhone);
      expect(result.deliveryOtp).toBe('123456');
    });

    it('Admin role CAN see customer phone number', async () => {
      const order = { ...mockGroceryOrderRow, deliveryPartnerId: null };

      setupMockDb({
        order,
        customerUser: mockCustomerUser,
        address: mockAddress,
        history: [],
      });

      const result = await orderService.getGroceryOrder(groceryOrderId, {
        userId: 'admin-123',
        role: 'admin',
      });

      expect(result.customer.phone).toBe(customerPhone);
    });
  });
});
