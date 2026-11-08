import { CatalogService } from './catalog.service';

describe('Meals Under 99: publicMealsUnder99', () => {
  let catalogService: CatalogService;
  let mockDb: any;
  let mockNotifications: any;
  let mockVendorDiscounts: any;

  const mockVendors = [
    {
      id: 'vendor-1',
      businessName: 'Vendor One',
      type: 'restaurant',
      pickupLat: 24.924,
      pickupLng: 76.283,
      radiusKm: 10,
      isOpen: true,
      showInApp: true,
    },
    {
      id: 'vendor-2',
      businessName: 'Vendor Two',
      type: 'restaurant',
      pickupLat: 24.924,
      pickupLng: 76.283,
      radiusKm: 10,
      isOpen: true,
      showInApp: true,
    },
    {
      id: 'vendor-3',
      businessName: 'Vendor Three',
      type: 'restaurant',
      pickupLat: 24.924,
      pickupLng: 76.283,
      radiusKm: 10,
      isOpen: true,
      showInApp: true,
    },
  ];

  const mockRestaurants = [
    { id: 'rest-1', vendorId: 'vendor-1', name: 'Restaurant 1', ratingAvg: 4.5, isOpen: true, mealTimings: null },
    { id: 'rest-2', vendorId: 'vendor-2', name: 'Restaurant 2', ratingAvg: 4.0, isOpen: true, mealTimings: null },
    { id: 'rest-3', vendorId: 'vendor-3', name: 'Restaurant 3', ratingAvg: 3.8, isOpen: true, mealTimings: null },
  ];

  const mockCategories = [
    { id: 'cat-1', restaurantId: 'rest-1', name: 'Cat 1' },
    { id: 'cat-2', restaurantId: 'rest-2', name: 'Cat 2' },
    { id: 'cat-3', restaurantId: 'rest-3', name: 'Cat 3' },
  ];

  // Rest 1 has 5 items (all under 99)
  // Rest 2 has 4 items
  // Rest 3 has 4 items
  const mockItems = [
    { id: 'item-1-1', menuCategoryId: 'cat-1', name: 'Dish 1-1', price: 50, isAvailable: true, mealSlots: null },
    { id: 'item-1-2', menuCategoryId: 'cat-1', name: 'Dish 1-2', price: 60, isAvailable: true, mealSlots: null },
    { id: 'item-1-3', menuCategoryId: 'cat-1', name: 'Dish 1-3', price: 70, isAvailable: true, mealSlots: null },
    { id: 'item-1-4', menuCategoryId: 'cat-1', name: 'Dish 1-4', price: 80, isAvailable: true, mealSlots: null },
    { id: 'item-1-5', menuCategoryId: 'cat-1', name: 'Dish 1-5', price: 90, isAvailable: true, mealSlots: null },

    { id: 'item-2-1', menuCategoryId: 'cat-2', name: 'Dish 2-1', price: 40, isAvailable: true, mealSlots: null },
    { id: 'item-2-2', menuCategoryId: 'cat-2', name: 'Dish 2-2', price: 45, isAvailable: true, mealSlots: null },
    { id: 'item-2-3', menuCategoryId: 'cat-2', name: 'Dish 2-3', price: 55, isAvailable: true, mealSlots: null },
    { id: 'item-2-4', menuCategoryId: 'cat-2', name: 'Dish 2-4', price: 65, isAvailable: true, mealSlots: null },

    { id: 'item-3-1', menuCategoryId: 'cat-3', name: 'Dish 3-1', price: 30, isAvailable: true, mealSlots: null },
    { id: 'item-3-2', menuCategoryId: 'cat-3', name: 'Dish 3-2', price: 35, isAvailable: true, mealSlots: null },
    { id: 'item-3-3', menuCategoryId: 'cat-3', name: 'Dish 3-3', price: 75, isAvailable: true, mealSlots: null },
    { id: 'item-3-4', menuCategoryId: 'cat-3', name: 'Dish 3-4', price: 85, isAvailable: true, mealSlots: null },
  ];

  // Sales quantities
  const mockSales = [
    { menuItemId: 'item-1-1', soldQty: 100 },
    { menuItemId: 'item-1-2', soldQty: 90 },
    { menuItemId: 'item-1-3', soldQty: 80 },
    { menuItemId: 'item-1-4', soldQty: 70 }, // Should be excluded by max 3 per vendor!
    { menuItemId: 'item-1-5', soldQty: 60 }, // Should be excluded by max 3 per vendor!
    { menuItemId: 'item-2-1', soldQty: 50 },
    { menuItemId: 'item-2-2', soldQty: 40 },
    { menuItemId: 'item-3-1', soldQty: 30 },
  ];

  beforeEach(() => {
    mockNotifications = {};
    mockVendorDiscounts = {
      getActiveDiscountsForVendor: jest.fn().mockResolvedValue([]),
      calculateItemDiscount: jest.fn().mockImplementation((price: number) => ({
        price,
        originalPrice: price,
        discountApplied: false,
      })),
    };

    let queryCallCount = 0;
    const makeChain = (getData: () => any) => {
      const chain: any = {
        from: jest.fn().mockImplementation((table: any) => chain),
        where: jest.fn().mockImplementation(() => chain),
        innerJoin: jest.fn().mockImplementation(() => chain),
        groupBy: jest.fn().mockImplementation(() => chain),
        then: jest.fn().mockImplementation((resolve) => resolve(getData())),
      };
      return chain;
    };

    mockDb = {
      select: jest.fn().mockImplementation(() => {
        queryCallCount++;
        const currentCount = ((queryCallCount - 1) % 7) + 1;
        return makeChain(() => {
          // 1. allVendors
          if (currentCount === 1) return mockVendors;
          // 2. restRows
          if (currentCount === 2) return mockRestaurants;
          // 3. catRows
          if (currentCount === 3) return mockCategories;
          // 4. itemRows
          if (currentCount === 4) return mockItems;
          // 5. salesRows
          if (currentCount === 5) return mockSales;
          // 6. addons
          if (currentCount === 6) return [];
          // 7. variants
          if (currentCount === 7) return [];
          return [];
        });
      }),
    };

    catalogService = new CatalogService(mockDb, mockNotifications, mockVendorDiscounts);
  });

  it('loads 6 items in round 1 with highest sales ranking', async () => {
    const res = await catalogService.publicMealsUnder99(24.924, 76.283, 1, 6);
    expect(res.page).toBe(1);
    expect(res.limit).toBe(6);
    expect(res.items.length).toBe(6);

    // The first 3 should be item-1-1, item-1-2, item-1-3 (sales: 100, 90, 80)
    expect(res.items[0].id).toBe('item-1-1');
    expect(res.items[0].salesCount).toBe(100);
    expect(res.items[1].id).toBe('item-1-2');
    expect(res.items[1].salesCount).toBe(90);
    expect(res.items[2].id).toBe('item-1-3');
    expect(res.items[2].salesCount).toBe(80);

    // Since restaurant 1 already reached 3 items, item-1-4 (sales 70) and item-1-5 (sales 60)
    // MUST NOT be chosen!
    // Next should come item-2-1 (sales: 50), item-2-2 (sales: 40), item-3-1 (sales: 30)
    expect(res.items[3].id).toBe('item-2-1');
    expect(res.items[4].id).toBe('item-2-2');
    expect(res.items[5].id).toBe('item-3-1');

    // Verify not all 6 items are from rest-1
    const rest1Count = res.items.filter((i) => i.restaurantId === 'rest-1').length;
    expect(rest1Count).toBe(3);
    expect(rest1Count).toBeLessThan(6);
  });

  it('enforces max 3 products per vendor across all rounds and does not exceed 30 items', async () => {
    const res = await catalogService.publicMealsUnder99(24.924, 76.283, 1, 6);
    // Across total pool, rest-1 has 3 items, rest-2 has 3 items, rest-3 has 3 items = total 9 items
    expect(res.total).toBe(9);
    expect(res.hasMore).toBe(true);

    const counts: Record<string, number> = {};
    for (const item of res.items) {
      counts[item.restaurantId] = (counts[item.restaurantId] || 0) + 1;
    }
    for (const count of Object.values(counts)) {
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  it('paginates correctly to round 2 without duplicating items from round 1', async () => {
    const res1 = await catalogService.publicMealsUnder99(24.924, 76.283, 1, 6);
    expect(res1.items.length).toBe(6);

    const res2 = await catalogService.publicMealsUnder99(24.924, 76.283, 2, 6);
    expect(res2.page).toBe(2);
    expect(res2.items.length).toBe(3); // remaining items in pool
    expect(res2.hasMore).toBe(false);

    // Verify no intersection between round 1 and round 2
    const ids1 = new Set(res1.items.map((i) => i.id));
    for (const item of res2.items) {
      expect(ids1.has(item.id)).toBe(false);
    }
  });

  it('returns empty and hasMore: false when page > 5', async () => {
    const res = await catalogService.publicMealsUnder99(24.924, 76.283, 6, 6);
    expect(res.items).toEqual([]);
    expect(res.hasMore).toBe(false);
  });
});
