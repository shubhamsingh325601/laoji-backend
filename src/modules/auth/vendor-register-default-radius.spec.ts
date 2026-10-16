import { getTableName, type Table } from 'drizzle-orm';
import { AuthService } from './auth.service';
import { CatalogService } from '../catalog/catalog.service';
import { DEFAULT_VENDOR_RADIUS_KM } from '../catalog/catalog.types';

// A vendor signing up in the app gets the 4 km default delivery radius, set by
// the server whatever the app sends (older builds send 2000). An existing
// vendor's radius, often set by an admin, is never touched by signing up again
// or by a profile edit.

type Row = Record<string, any>;

// Just enough of drizzle's query builder: every select on a table resolves to
// that table's rows, and inserts/updates are recorded with the values written.
function fakeDb(tables: Record<string, Row[]>) {
  const inserts: { table: string; values: Row }[] = [];
  const updates: { table: string; set: Row }[] = [];
  const chain = (result: () => Row[]): object =>
    new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === 'then'
            ? (resolve: (v: Row[]) => void, reject: (e: unknown) => void) => {
                try {
                  resolve(result());
                } catch (e) {
                  reject(e);
                }
              }
            : () => chain(result),
      },
    );
  const db = {
    select: () => ({
      from: (table: Table) => chain(() => tables[getTableName(table)] ?? []),
    }),
    insert: (table: Table) => ({
      values: (values: Row) => {
        const row = { id: `${getTableName(table)}-1`, ...values };
        inserts.push({ table: getTableName(table), values });
        return chain(() => [row]);
      },
    }),
    update: (table: Table) => ({
      set: (set: Row) => {
        updates.push({ table: getTableName(table), set });
        const existing = tables[getTableName(table)]?.[0] ?? {};
        return chain(() => [{ ...existing, ...set }]);
      },
    }),
  };
  return { db, inserts, updates };
}

const jwt = { sign: () => 'token' };
const config = { get: () => undefined };

const signup = {
  phone: '9876543210',
  password: 'secret123',
  businessName: 'Sharma Kirana',
  ownerName: 'Ramesh Sharma',
  type: 'grocery' as const,
  pickupLat: 24.93,
  pickupLng: 76.29,
};

const profile = {
  businessName: 'Sharma Kirana',
  ownerName: 'Ramesh Sharma',
  type: 'grocery' as const,
  pickupLat: 24.93,
  pickupLng: 76.29,
};

describe('Vendor signup delivery radius', () => {
  it('is 4 km', () => {
    expect(DEFAULT_VENDOR_RADIUS_KM).toBe(4);
  });

  describe('POST /auth/vendor/register', () => {
    it.each([
      ['the current app (4)', 4],
      ['an older app build (2000)', 2000],
      ['no radius', undefined],
    ])('stores 4 km for a new vendor sending %s', async (_label, radiusKm) => {
      const { db, inserts } = fakeDb({});
      const auth = new AuthService(db as any, jwt as any, config as any);

      const res = await auth.vendorRegister({
        ...signup,
        ...(radiusKm !== undefined ? { radiusKm } : {}),
      });

      const vendor = inserts.find((i) => i.table === 'vendors');
      expect(vendor?.values.radiusKm).toBe(4);
      expect(vendor?.values.pickupLat).toBe(signup.pickupLat);
      expect(vendor?.values.pickupLng).toBe(signup.pickupLng);
      expect((res.vendor as Row).radiusKm).toBe(4);
    });

    it('turns away a phone that already has a store, leaving its radius alone', async () => {
      const { db, inserts, updates } = fakeDb({
        users: [
          {
            id: 'u1',
            phone: signup.phone,
            role: 'vendor',
            status: 'active',
            passwordHash: 'x',
          },
        ],
        vendors: [{ id: 'v1', userId: 'u1', radiusKm: 12 }],
      });
      const auth = new AuthService(db as any, jwt as any, config as any);

      await expect(
        auth.vendorRegister({ ...signup, radiusKm: 2000 } as any),
      ).rejects.toThrow('already exists');
      expect(inserts.some((i) => i.table === 'vendors')).toBe(false);
      expect(updates.some((u) => 'radiusKm' in u.set)).toBe(false);
    });
  });

  describe('POST /vendors/me', () => {
    it.each([2000, undefined])(
      'creates a missing store profile with 4 km (app sent %s)',
      async (radiusKm) => {
        const { db, inserts } = fakeDb({});
        const catalog = new CatalogService(db as any, {} as any, {} as any);

        await catalog.upsertVendorProfile('u1', {
          ...profile,
          ...(radiusKm !== undefined ? { radiusKm } : {}),
        });

        expect(
          inserts.find((i) => i.table === 'vendors')?.values.radiusKm,
        ).toBe(4);
      },
    );

    it("keeps an existing vendor's admin-set radius on a profile edit", async () => {
      const { db, inserts, updates } = fakeDb({
        vendors: [
          {
            id: 'v1',
            userId: 'u1',
            radiusKm: 12,
            pickupLat: 24.93,
            pickupLng: 76.29,
          },
        ],
        users: [{ id: 'u1', phone: signup.phone }],
      });
      const catalog = new CatalogService(db as any, {} as any, {} as any);

      const saved = await catalog.upsertVendorProfile('u1', {
        ...profile,
        radiusKm: 2000,
      });

      expect(inserts.some((i) => i.table === 'vendors')).toBe(false);
      const vendorUpdate = updates.find((u) => u.table === 'vendors');
      expect(vendorUpdate).toBeDefined();
      expect('radiusKm' in vendorUpdate!.set).toBe(false);
      expect(saved.radiusKm).toBe(12);
    });
  });
});
