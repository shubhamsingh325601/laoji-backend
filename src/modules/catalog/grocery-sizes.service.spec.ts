import { BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DataType, newDb } from 'pg-mem';
import * as schema from '../../../drizzle/schema';
import { GrocerySizesService } from './grocery-sizes.service';

// Runs the size-group writes against an in-memory Postgres, so the SQL and the
// transaction (all-or-nothing on a bad request) are exercised for real.
function setup() {
  const mem = newDb();
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: randomUUID,
    impure: true,
  });
  mem.public.none(`
    CREATE TABLE products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id uuid NOT NULL,
      brand varchar(150),
      name varchar(200) NOT NULL,
      description text,
      unit varchar(50) NOT NULL,
      size varchar(50),
      mrp double precision,
      wholesale_price double precision,
      selling_price double precision,
      image_url text,
      attributes jsonb,
      status text NOT NULL DEFAULT 'active',
      owner_vendor_id uuid,
      template_product_id uuid,
      variant_group_id uuid,
      variant_label varchar(50),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE vendor_products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      vendor_id uuid NOT NULL,
      product_id uuid NOT NULL,
      price double precision NOT NULL,
      wholesale_price double precision,
      stock_qty integer NOT NULL DEFAULT 0,
      is_available boolean NOT NULL DEFAULT true,
      commission_pct double precision,
      offer_tag varchar(100),
      low_stock_threshold integer,
      restock_eta date,
      last_restocked_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE platform_settings (
      key varchar(100) PRIMARY KEY,
      value text NOT NULL,
      description text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by uuid
    );
  `);
  const { Pool, Client } = mem.adapters.createPg();
  // pg-mem doesn't take drizzle's custom type parsers (the defaults do here)
  // or `rowMode: 'array'`; rows keep column order (a repeated name becomes
  // `id1`), so array rows are rebuilt from each row's values. Its ROLLBACK is
  // a no-op, so a transaction is a snapshot restored on rollback.
  let snapshot: ReturnType<typeof mem.backup> | null = null;
  for (const Cls of [Pool, Client]) {
    const query = Cls.prototype.query;
    Cls.prototype.query = async function (config: any, ...rest: any[]) {
      const text = String(
        typeof config === 'string' ? config : (config?.text ?? ''),
      )
        .trim()
        .toLowerCase();
      if (text === 'begin') {
        snapshot = mem.backup();
      } else if (text === 'rollback') {
        snapshot?.restore();
        snapshot = null;
        return { rows: [], fields: [], rowCount: 0 };
      } else if (text === 'commit') {
        snapshot = null;
      }
      if (!config || typeof config !== 'object')
        return query.call(this, config, ...rest);
      const { types: _types, rowMode, ...plain } = config;
      const result = await query.call(this, plain, ...rest);
      return rowMode === 'array'
        ? { ...result, rows: result.rows.map((r: object) => Object.values(r)) }
        : result;
    };
  }
  const db = drizzle(new Pool(), { schema });
  return { mem, db, service: new GrocerySizesService(db as any) };
}

const VENDOR = '11111111-1111-4111-8111-111111111111';
const OTHER_VENDOR = '22222222-2222-4222-8222-222222222222';
const CATEGORY = '33333333-3333-4333-8333-333333333333';

async function addItem(
  db: ReturnType<typeof setup>['db'],
  opts: {
    owner?: string | null;
    vendor?: string;
    unit?: string;
    price?: number;
    commissionPct?: number | null;
  } = {},
) {
  const [product] = await db
    .insert(schema.products)
    .values({
      categoryId: CATEGORY,
      name: 'Paras desi ghee',
      description: 'Pure cow ghee',
      unit: opts.unit ?? '900ml',
      imageUrl: 'https://img/ghee.jpg',
      status: 'active',
      ownerVendorId: opts.owner === undefined ? VENDOR : opts.owner,
    })
    .returning();
  const [listing] = await db
    .insert(schema.vendorProducts)
    .values({
      vendorId: opts.vendor ?? VENDOR,
      productId: product.id,
      price: opts.price ?? 580,
      stockQty: 100,
      commissionPct: opts.commissionPct ?? 5,
    })
    .returning();
  return { product, listing };
}

async function allProducts(db: ReturnType<typeof setup>['db']) {
  return db.select().from(schema.products);
}
async function allListings(db: ReturnType<typeof setup>['db']) {
  return db.select().from(schema.vendorProducts);
}

describe('GrocerySizesService', () => {
  describe('feature switch', () => {
    it('is off until an admin turns it on', async () => {
      const { service } = setup();
      expect(await service.isEnabled()).toBe(false);
      await service.setEnabled(true, undefined);
      expect(await service.isEnabled()).toBe(true);
      await service.setEnabled(false, undefined);
      expect(await service.isEnabled()).toBe(false);
    });
  });

  describe('syncSizes', () => {
    it('adds a size as its own product and listing in the item’s group', async () => {
      const { db, service } = setup();
      const { product, listing } = await addItem(db);

      await service.syncSizes(VENDOR, listing.id, [
        { label: '180ml', price: 130, stockQty: 20 },
      ]);

      const prods = await allProducts(db);
      const primary = prods.find((p) => p.id === product.id)!;
      const size = prods.find((p) => p.id !== product.id)!;
      expect(primary.variantGroupId).toBeTruthy();
      expect(primary.variantLabel).toBe('900ml');
      expect(size).toMatchObject({
        name: 'Paras desi ghee',
        description: 'Pure cow ghee',
        imageUrl: 'https://img/ghee.jpg',
        categoryId: CATEGORY,
        unit: '180ml',
        variantLabel: '180ml',
        variantGroupId: primary.variantGroupId,
        ownerVendorId: VENDOR,
        status: 'active',
      });

      const sizeListing = (await allListings(db)).find(
        (l) => l.productId === size.id,
      )!;
      expect(sizeListing).toMatchObject({
        vendorId: VENDOR,
        price: 130,
        stockQty: 20,
        isAvailable: true,
        commissionPct: 5,
      });
      // The item's own listing is untouched.
      expect(
        (await allListings(db)).find((l) => l.id === listing.id),
      ).toMatchObject({ price: 580, stockQty: 100 });
    });

    it('updates kept sizes, adds new ones and retires dropped ones', async () => {
      const { db, service } = setup();
      const { listing } = await addItem(db);
      await service.syncSizes(VENDOR, listing.id, [
        { label: '180ml', price: 130 },
        { label: '500ml', price: 320 },
      ]);
      const before = await allListings(db);
      const small = before.find((l) => l.price === 130)!;
      const medium = before.find((l) => l.price === 320)!;

      await service.syncSizes(VENDOR, listing.id, [
        { listingId: small.id, label: '200ml', price: 140, isAvailable: false },
        { label: '1L', price: 640 },
      ]);

      const listings = await allListings(db);
      expect(listings.find((l) => l.id === small.id)).toMatchObject({
        price: 140,
        isAvailable: false,
      });
      expect(listings.find((l) => l.id === medium.id)).toBeUndefined();
      expect(listings.find((l) => l.price === 640)).toBeTruthy();

      const prods = await allProducts(db);
      expect(prods.find((p) => p.id === small.productId)).toMatchObject({
        unit: '200ml',
        variantLabel: '200ml',
      });
      // A retired size stays as a hidden product for past orders, outside the group.
      expect(prods.find((p) => p.id === medium.productId)).toMatchObject({
        status: 'inactive',
        variantGroupId: null,
        variantLabel: null,
      });
    });

    it('ungroups the item when every extra size is removed', async () => {
      const { db, service } = setup();
      const { product, listing } = await addItem(db);
      await service.syncSizes(VENDOR, listing.id, [
        { label: '180ml', price: 130 },
      ]);

      await service.syncSizes(VENDOR, listing.id, []);

      expect(await allListings(db)).toHaveLength(1);
      expect(
        (await allProducts(db)).find((p) => p.id === product.id),
      ).toMatchObject({
        variantGroupId: null,
        variantLabel: null,
        status: 'active',
      });
    });

    it('leaves a standalone item exactly as it was when given no sizes', async () => {
      const { db, service } = setup();
      const { product, listing } = await addItem(db);
      await service.syncSizes(VENDOR, listing.id, []);
      expect(await allProducts(db)).toEqual([product]);
      expect(await allListings(db)).toEqual([listing]);
    });

    it('rejects repeated size names and changes nothing', async () => {
      const { db, service } = setup();
      const { listing } = await addItem(db);
      await service.syncSizes(VENDOR, listing.id, [
        { label: '180ml', price: 130 },
      ]);
      const prodsBefore = await allProducts(db);
      const listingsBefore = await allListings(db);

      await expect(
        service.syncSizes(VENDOR, listing.id, [
          { label: '180ml', price: 130 },
          { label: '180ML', price: 150 },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.syncSizes(VENDOR, listing.id, [{ label: '900ml', price: 1 }]),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(await allProducts(db)).toEqual(prodsBefore);
      expect(await allListings(db)).toEqual(listingsBefore);
    });

    it('copies a shared Laoji product for the vendor and leaves the original alone', async () => {
      const { db, service } = setup();
      const { product: master, listing } = await addItem(db, { owner: null });

      await service.syncSizes(VENDOR, listing.id, [
        { label: '180ml', price: 130 },
      ]);

      const prods = await allProducts(db);
      expect(prods.find((p) => p.id === master.id)).toEqual(master);
      const relisted = (await allListings(db)).find(
        (l) => l.id === listing.id,
      )!;
      const copy = prods.find((p) => p.id === relisted.productId)!;
      expect(copy).toMatchObject({
        ownerVendorId: VENDOR,
        templateProductId: master.id,
        variantLabel: '900ml',
      });
      expect(copy.variantGroupId).toBeTruthy();
    });

    it('only touches the given vendor’s listing', async () => {
      const { db, service } = setup();
      const { listing } = await addItem(db, {
        vendor: OTHER_VENDOR,
        owner: OTHER_VENDOR,
      });
      await expect(
        service.syncSizes(VENDOR, listing.id, [{ label: '180ml', price: 130 }]),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(await allListings(db)).toHaveLength(1);
    });

    it('refuses a size id that is not one of this item’s sizes, undoing what it had written', async () => {
      const { db, service } = setup();
      const { listing } = await addItem(db);
      const { listing: unrelated } = await addItem(db, { unit: '1kg' });
      const prodsBefore = await allProducts(db);
      const listingsBefore = await allListings(db);

      await expect(
        service.syncSizes(VENDOR, listing.id, [
          { label: '500ml', price: 320 },
          { listingId: unrelated.id, label: '180ml', price: 130 },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);

      // The 500ml size and the grouping were written before the bad id; all rolled back.
      expect(await allProducts(db)).toEqual(prodsBefore);
      expect(await allListings(db)).toEqual(listingsBefore);
    });
  });

  describe('withPublicSizes', () => {
    const { service } = setup();
    const item = (
      id: string,
      groupId: string | null,
      unit: string,
      price: number,
      inStock = true,
    ) => ({
      id,
      variantGroupId: groupId,
      variantLabel: groupId ? unit : null,
      unit,
      price,
      mrp: null,
      inStock,
    });

    it('gives each grouped product all sizes in the result, cheapest first', () => {
      const out = service.withPublicSizes([
        item('big', 'g1', '900ml', 580),
        item('small', 'g1', '180ml', 130, false),
        item('alone', null, '1 pc', 50),
      ]);
      const expected = [
        {
          productId: 'small',
          label: '180ml',
          price: 130,
          mrp: null,
          inStock: false,
        },
        {
          productId: 'big',
          label: '900ml',
          price: 580,
          mrp: null,
          inStock: true,
        },
      ];
      expect(out[0].sizes).toEqual(expected);
      expect(out[1].sizes).toEqual(expected);
      expect(out[2].sizes).toEqual([]);
    });

    it('shows no sizes when only one size of a group is available', () => {
      expect(
        service.withPublicSizes([item('big', 'g1', '900ml', 580)])[0].sizes,
      ).toEqual([]);
    });

    it('keeps every original field', () => {
      const original = item('alone', null, '1 pc', 50);
      expect(service.withPublicSizes([original])[0]).toEqual({
        ...original,
        sizes: [],
      });
    });
  });

  describe('adminSizesFor', () => {
    const { service } = setup();
    const row = (
      id: string,
      groupId: string | null,
      unit: string,
      price: number,
    ) => ({
      id,
      productId: `p-${id}`,
      variantGroupId: groupId,
      variantLabel: groupId ? unit : null,
      unit,
      price,
      stockQty: 10,
      isAvailable: true,
    });

    it('lists the item’s other sizes, not itself', () => {
      const rows = [
        row('a', 'g1', '900ml', 580),
        row('b', 'g1', '180ml', 130),
        row('c', null, '1 pc', 50),
      ];
      expect(service.adminSizesFor(rows[0], rows)).toEqual([
        {
          listingId: 'b',
          productId: 'p-b',
          label: '180ml',
          price: 130,
          stockQty: 10,
          isAvailable: true,
        },
      ]);
      expect(service.adminSizesFor(rows[2], rows)).toEqual([]);
    });
  });

  describe('assertValidLabels', () => {
    const { service } = setup();

    it('accepts distinct names and no sizes at all', () => {
      expect(() => service.assertValidLabels('1kg', [{ label: '500g' }, { label: ' 2kg ' }])).not.toThrow();
      expect(() => service.assertValidLabels('1kg', [])).not.toThrow();
    });

    it('rejects a blank name or one repeating another size or the item’s unit', () => {
      expect(() => service.assertValidLabels('1kg', [{ label: '  ' }])).toThrow(BadRequestException);
      expect(() => service.assertValidLabels('1kg', [{ label: '1KG' }])).toThrow(BadRequestException);
      expect(() => service.assertValidLabels('1kg', [{ label: '500g' }, { label: '500G' }])).toThrow(BadRequestException);
    });
  });
});
