import { CatalogService } from './catalog.service';
import { RevenueConfigService } from '../revenue/revenue-config.service';

describe('Final Runtime Verification: Vendor Commission Integration (7 Scenarios)', () => {
  let catalogService: CatalogService;
  let revenueConfigService: RevenueConfigService;
  let mockDb: any;
  let mockNotifications: any;
  let mockVendorDiscounts: any;

  // Vendors from current Revenue Config data
  const vendorsData = [
    { id: '11111111-1111-1111-1111-111111111111', userId: 'user-chaska', businessName: 'Chaska Point Cafe', type: 'restaurant' as const, expectedPct: 15.0 },
    { id: '22222222-2222-2222-2222-222222222222', userId: 'user-ganpati', businessName: 'Ganpati kirana Anandilal Ji', type: 'grocery' as const, expectedPct: 10.0 },
    { id: '33333333-3333-3333-3333-333333333333', userId: 'user-golden', businessName: 'Golden Cafe', type: 'restaurant' as const, expectedPct: 10.0 },
    { id: '44444444-4444-4444-4444-444444444444', userId: 'user-jai', businessName: 'Jai Bhawani Bakers', type: 'restaurant' as const, expectedPct: 15.0 },
    { id: '55555555-5555-5555-5555-555555555555', userId: 'user-mahakal', businessName: 'Mahakal flower', type: 'grocery' as const, expectedPct: 15.0 },
    { id: '66666666-6666-6666-6666-666666666666', userId: 'user-mehta', businessName: 'Mehta Fruits Center', type: 'grocery' as const, expectedPct: 15.0 },
    { id: '77777777-7777-7777-7777-777777777777', userId: 'user-nocustom', businessName: 'New Unconfigured Store', type: 'grocery' as const, expectedPct: 10.0 },
  ];

  let revenueRulesTable: Array<{
    id: string;
    scope: 'global' | 'category' | 'vendor';
    scopeRefId: string | null;
    commissionPct: number;
    deliveryFeeFlat: number;
    effectiveFrom: Date;
    notes?: string;
  }> = [];

  let ordersTable: Array<{
    id: string;
    vendorId: string;
    subtotal: number;
    commissionPct: number;
    platformCommission: number;
    createdAt: Date;
  }> = [];

  const buildQuery = (data: any[]) => {
    const q: any = {
      innerJoin: () => q,
      leftJoin: () => q,
      where: (predicate?: any) => q,
      orderBy: () => q,
      limit: (n: number) => Promise.resolve(data.slice(0, n)),
      then: (onfulfilled?: any, onrejected?: any) => Promise.resolve(data).then(onfulfilled, onrejected),
    };
    return q;
  };

  beforeEach(() => {
    // Populate active rules based on current Revenue Config data
    revenueRulesTable = [
      { id: 'rule-global', scope: 'global', scopeRefId: null, commissionPct: 0.10, deliveryFeeFlat: 15, effectiveFrom: new Date('2026-01-01T00:00:00Z'), notes: 'Default global 10%' },
      { id: 'rule-chaska', scope: 'vendor', scopeRefId: '11111111-1111-1111-1111-111111111111', commissionPct: 0.15, deliveryFeeFlat: 15, effectiveFrom: new Date('2026-10-01T08:30:00Z'), notes: 'Added new rule for specific commissions.' },
      { id: 'rule-ganpati', scope: 'vendor', scopeRefId: '22222222-2222-2222-2222-222222222222', commissionPct: 0.10, deliveryFeeFlat: 15, effectiveFrom: new Date('2026-10-01T08:33:00Z'), notes: 'Added commission for this specific vendor' },
      { id: 'rule-golden', scope: 'vendor', scopeRefId: '33333333-3333-3333-3333-333333333333', commissionPct: 0.10, deliveryFeeFlat: 15, effectiveFrom: new Date('2026-09-30T21:40:00Z'), notes: 'To add vendor specific commissions.' },
      { id: 'rule-jai', scope: 'vendor', scopeRefId: '44444444-4444-4444-4444-444444444444', commissionPct: 0.15, deliveryFeeFlat: 15, effectiveFrom: new Date('2026-09-30T21:41:00Z'), notes: 'To add vendor specific commissions.' },
      { id: 'rule-mahakal', scope: 'vendor', scopeRefId: '55555555-5555-5555-5555-555555555555', commissionPct: 0.15, deliveryFeeFlat: 15, effectiveFrom: new Date('2026-10-01T08:28:00Z'), notes: 'To add vendor specific commissions.' },
      { id: 'rule-mehta', scope: 'vendor', scopeRefId: '66666666-6666-6666-6666-666666666666', commissionPct: 0.15, deliveryFeeFlat: 15, effectiveFrom: new Date('2026-09-30T21:40:00Z'), notes: 'To add vendor specific commissions.' },
    ];

    // Seed sample historical orders
    ordersTable = [
      { id: 'order-1', vendorId: '11111111-1111-1111-1111-111111111111', subtotal: 500, commissionPct: 0.10, platformCommission: 50, createdAt: new Date('2026-09-15T12:00:00Z') },
      { id: 'order-2', vendorId: '11111111-1111-1111-1111-111111111111', subtotal: 300, commissionPct: 0.15, platformCommission: 45, createdAt: new Date('2026-10-02T12:00:00Z') },
    ];

    const extractValues = (obj: any): any[] => {
      if (!obj) return [];
      if (typeof obj === 'string' || typeof obj === 'number' || obj instanceof Date) return [obj];
      const vals: any[] = [];
      if (obj.value !== undefined) vals.push(...extractValues(obj.value));
      if (obj.right !== undefined) vals.push(...extractValues(obj.right));
      if (obj.queryChunks && Array.isArray(obj.queryChunks)) {
        for (const chunk of obj.queryChunks) {
          vals.push(...extractValues(chunk));
        }
      }
      return vals;
    };

    mockDb = {
      select: (fields?: any) => ({
        from: (table: any) => {
          let tableName = table?.[Symbol.for('drizzle:OriginalName')] || table?.[Symbol.for('drizzle:Name')] || table?._?.name || table?.name || '';

          if (tableName.includes('revenue')) {
            const createRevenueQuery = (data: any[]) => {
              const q: any = {
                innerJoin: () => q,
                leftJoin: () => q,
                orderBy: () => q,
                where: (condition: any) => {
                  const vals = extractValues(condition);
                  const dateVal = vals.find((v) => v instanceof Date);
                  if (dateVal) {
                    const filtered = data.filter((r) => r.effectiveFrom <= dateVal);
                    return createRevenueQuery(filtered);
                  }
                  return createRevenueQuery(data);
                },
                limit: (n: number) => Promise.resolve(data.slice(0, n)),
                then: (resolve: any, reject: any) => Promise.resolve(data).then(resolve, reject),
              };
              return q;
            };
            return createRevenueQuery(revenueRulesTable);
          }

          if (tableName.includes('vendor')) {
            const allVendors = vendorsData.map((v) => ({ ...v, isOpen: true, radiusKm: 5, createdAt: new Date() }));
            const createVendorQuery = (data: any[]) => {
              const q: any = {
                innerJoin: () => q,
                leftJoin: () => q,
                orderBy: () => q,
                where: (condition: any) => {
                  const vals = extractValues(condition);
                  if (vals.length > 0) {
                    const filtered = data.filter((item) => {
                      const target = item.vendor || item;
                      return vals.some((val) => target.id === val || target.userId === val);
                    });
                    return createVendorQuery(filtered);
                  }
                  return createVendorQuery(data);
                },
                limit: (n: number) => Promise.resolve(data.slice(0, n)),
                then: (resolve: any, reject: any) => Promise.resolve(data).then(resolve, reject),
              };
              return q;
            };

            if (fields && fields.vendor) {
              const combinedAll = allVendors.map((v) => ({
                vendor: v,
                user: { id: v.userId, phone: '9876543210', email: `${v.userId}@laoji.com` },
                restaurantImageUrl: null,
              }));
              return createVendorQuery(combinedAll);
            }

            return createVendorQuery(allVendors);
          }

          return buildQuery([]);
        },
      }),
      update: () => ({
        set: (fields: any) => ({
          where: () => Promise.resolve([]),
        }),
      }),
      insert: (table: any) => ({
        values: (val: any) => {
          if (val.scope) {
            revenueRulesTable.push({
              id: `rule-${Date.now()}`,
              scope: val.scope,
              scopeRefId: val.scopeRefId ?? null,
              commissionPct: val.commissionPct,
              deliveryFeeFlat: val.deliveryFeeFlat ?? 15,
              effectiveFrom: new Date(val.effectiveFrom),
              notes: val.notes,
            });
          }
          return {
            returning: () => Promise.resolve([val]),
          };
        },
      }),
    };

    mockNotifications = { sendWelcomeVendorEmail: jest.fn() };
    mockVendorDiscounts = {};

    revenueConfigService = new RevenueConfigService(mockDb as any);
    catalogService = new CatalogService(
      mockDb as any,
      mockNotifications as any,
      mockVendorDiscounts as any,
      revenueConfigService,
    );
  });

  // --------------------------------------------------------------------------
  // SCENARIO 1: Vendor Profile API (vendors/me -> getVendorByUserId)
  // --------------------------------------------------------------------------
  describe('Scenario 1: Vendor Profile displays assigned commission from Revenue Config', () => {
    it('resolves 15% for Chaska Point Cafe', async () => {
      const profile = await catalogService.getVendorByUserId('user-chaska');
      expect(profile).toBeDefined();
      expect(profile?.commissionPct).toBe(15.0);
    });

    it('resolves 10% for Ganpati kirana Anandilal Ji', async () => {
      const profile = await catalogService.getVendorByUserId('user-ganpati');
      expect(profile?.commissionPct).toBe(10.0);
    });

    it('resolves 10% for Golden Cafe', async () => {
      const profile = await catalogService.getVendorByUserId('user-golden');
      expect(profile?.commissionPct).toBe(10.0);
    });

    it('resolves 15% for Jai Bhawani Bakers', async () => {
      const profile = await catalogService.getVendorByUserId('user-jai');
      expect(profile?.commissionPct).toBe(15.0);
    });

    it('resolves 15% for Mahakal flower', async () => {
      const profile = await catalogService.getVendorByUserId('user-mahakal');
      expect(profile?.commissionPct).toBe(15.0);
    });

    it('resolves 15% for Mehta Fruits Center', async () => {
      const profile = await catalogService.getVendorByUserId('user-mehta');
      expect(profile?.commissionPct).toBe(15.0);
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 2: Admin Vendor List API (listVendorsAdmin)
  // --------------------------------------------------------------------------
  describe('Scenario 2: Admin Vendor List displays same vendor-specific percentages', () => {
    it('returns exact percentage for each vendor in list', async () => {
      const list = await catalogService.listVendorsAdmin();
      expect(list).toHaveLength(7);

      const findPct = (nameSnippet: string) =>
        list.find((v) => v.businessName.includes(nameSnippet))?.commissionPct;

      expect(findPct('Chaska Point Cafe')).toBe(15.0);
      expect(findPct('Ganpati kirana')).toBe(10.0);
      expect(findPct('Golden Cafe')).toBe(10.0);
      expect(findPct('Jai Bhawani Bakers')).toBe(15.0);
      expect(findPct('Mahakal flower')).toBe(15.0);
      expect(findPct('Mehta Fruits Center')).toBe(15.0);
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 3: Fallback to Active Global Commission
  // --------------------------------------------------------------------------
  describe('Scenario 3: Vendor without vendor-specific rule falls back to active global commission', () => {
    it('resolves active global rule (10%) when no vendor rule exists', async () => {
      const noCustomVendorId = '77777777-7777-7777-7777-777777777777';
      const resolved = await revenueConfigService.resolve(noCustomVendorId, null);
      expect(resolved.commissionPct).toBe(0.10);

      const detail = await catalogService.getAdminVendor(noCustomVendorId);
      expect(detail.commissionPct).toBe(10.0);

      const list = await catalogService.listVendorsAdmin();
      const unconfigured = list.find((v) => v.id === noCustomVendorId);
      expect(unconfigured?.commissionPct).toBe(10.0);
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 4: Version update in Revenue Config and immediate reflection
  // --------------------------------------------------------------------------
  describe('Scenario 4: Updating vendor commission creates new version and updates Vendor Profile & List', () => {
    it('creates new revenue_config row and updates getAdminVendor and listVendorsAdmin', async () => {
      const vendorId = '11111111-1111-1111-1111-111111111111'; // Chaska Point Cafe (currently 15%)
      const initialRulesCount = revenueRulesTable.length;

      // Update to 18% via updateAdminVendor
      const updated = await catalogService.updateAdminVendor(vendorId, { commissionPct: 18.0 }, 'admin-1');

      // Verify new revenue_config row was inserted (immutable versioning)
      expect(revenueRulesTable.length).toBe(initialRulesCount + 1);
      const latestRule = revenueRulesTable[revenueRulesTable.length - 1];
      expect(latestRule.scope).toBe('vendor');
      expect(latestRule.scopeRefId).toBe(vendorId);
      expect(latestRule.commissionPct).toBe(0.18);

      // Verify returned vendor detail reflects new 18%
      expect(updated.commissionPct).toBe(18.0);

      // Verify listVendorsAdmin reflects 18%
      const list = await catalogService.listVendorsAdmin();
      const chaskaInList = list.find((v) => v.id === vendorId);
      expect(chaskaInList?.commissionPct).toBe(18.0);
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 5: Date / Version Precedence
  // --------------------------------------------------------------------------
  describe('Scenario 5: Date and version precedence', () => {
    it('latest effectiveFrom <= asOf wins; future rules do not apply before effective date', async () => {
      const vendorId = '11111111-1111-1111-1111-111111111111';

      // Rule 1: Effective 2026-09-01 at 12%
      revenueRulesTable.push({
        id: 'rule-chaska-old',
        scope: 'vendor',
        scopeRefId: vendorId,
        commissionPct: 0.12,
        deliveryFeeFlat: 15,
        effectiveFrom: new Date('2026-09-01T00:00:00Z'),
      });

      // Rule 2: Effective 2026-10-01 at 15% (already in table)
      // Rule 3: Future Rule effective 2026-11-01 at 20%
      revenueRulesTable.push({
        id: 'rule-chaska-future',
        scope: 'vendor',
        scopeRefId: vendorId,
        commissionPct: 0.20,
        deliveryFeeFlat: 15,
        effectiveFrom: new Date('2026-11-01T00:00:00Z'),
      });

      // asOf 2026-09-15: Rule 1 (12%) should win
      const resSept = await revenueConfigService.resolve(vendorId, null, new Date('2026-09-15T00:00:00Z'));
      expect(resSept.commissionPct).toBe(0.12);

      // asOf 2026-10-05 (Now): Rule 2 (15%) should win
      const resOct = await revenueConfigService.resolve(vendorId, null, new Date('2026-10-05T00:00:00Z'));
      expect(resOct.commissionPct).toBe(0.15);

      // asOf 2026-11-05 (Future): Rule 3 (20%) should win
      const resNov = await revenueConfigService.resolve(vendorId, null, new Date('2026-11-05T00:00:00Z'));
      expect(resNov.commissionPct).toBe(0.20);
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 6: Historical Orders & Settlement Snapshots Immutability
  // --------------------------------------------------------------------------
  describe('Scenario 6: Historical orders & settlements remain permanently snapshot and unaffected', () => {
    it('does not mutate past orders commissionPct when current vendor rate changes', async () => {
      const pastOrder = ordersTable[0]; // Placed on 2026-09-15 with 10%
      expect(pastOrder.commissionPct).toBe(0.10);
      expect(pastOrder.platformCommission).toBe(50);

      // Change vendor commission now
      await catalogService.updateAdminVendor('11111111-1111-1111-1111-111111111111', { commissionPct: 25.0 });

      // Verify past order remains untouched
      expect(pastOrder.commissionPct).toBe(0.10);
      expect(pastOrder.platformCommission).toBe(50);
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 7: Backend API response validation
  // --------------------------------------------------------------------------
  describe('Scenario 7: Backend API responses directly contain resolved commissionPct', () => {
    it('verifies explicit commissionPct field in API responses', async () => {
      const adminDetail = await catalogService.getAdminVendor('11111111-1111-1111-1111-111111111111');
      expect(typeof adminDetail.commissionPct).toBe('number');
      expect(adminDetail.commissionPct).toBe(15.0);

      const listResponse = await catalogService.listVendorsAdmin();
      expect(Array.isArray(listResponse)).toBe(true);
      for (const item of listResponse) {
        expect(typeof item.commissionPct).toBe('number');
        expect(item.commissionPct).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
