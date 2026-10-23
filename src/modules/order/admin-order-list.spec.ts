import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../../drizzle/schema';
import { OrderService } from './order.service';
import {
  escapeLike,
  istDayEnd,
  istDayStart,
  paymentStatusesForFilter,
  statusesForFilter,
} from './admin-order-filters';

describe('admin order list filters', () => {
  it('maps the screen stages onto backend statuses the way the old in-browser filter did', () => {
    expect(statusesForFilter('accepted', 'grocery')).toEqual(['vendor_accepted']);
    expect(statusesForFilter('picked_up', 'food')).toEqual(['handed_over', 'delivery_assigned', 'picked_up']);
    expect(statusesForFilter('delivered', 'food')).toEqual(['delivered']);
  });

  it('treats a failed food order as cancelled and a failed grocery order as allocation_failed', () => {
    expect(statusesForFilter('cancelled', 'grocery')).toEqual(['cancelled']);
    expect(statusesForFilter('cancelled', 'food')).toEqual(['cancelled', 'failed']);
    expect(statusesForFilter('allocation_failed', 'grocery')).toEqual(['failed']);
    expect(statusesForFilter('allocation_failed', 'food')).toEqual([]);
  });

  it('accepts the COD pending dropdown value for the stored pending_cod', () => {
    expect(paymentStatusesForFilter('cod_pending')).toEqual(['pending_cod', 'cod_pending']);
    expect(paymentStatusesForFilter('paid')).toEqual(['paid']);
  });

  it('runs a picked day from midnight to midnight IST', () => {
    expect(istDayStart('2026-10-23').toISOString()).toBe('2026-10-22T18:30:00.000Z');
    expect(istDayEnd('2026-10-23').toISOString()).toBe('2026-10-23T18:29:59.999Z');
  });

  it('escapes ILIKE wildcards so they are searched literally', () => {
    expect(escapeLike('50%_off\\x')).toBe('50\\%\\_off\\\\x');
    expect(escapeLike('ab12cd34')).toBe('ab12cd34');
  });
});

describe('OrderService.adminOrderWhere', () => {
  // The method only builds SQL, so no database or collaborators are needed;
  // the query is rendered with toSQL() and never executed.
  const service = Object.create(OrderService.prototype) as OrderService;
  const db = drizzle(new Pool(), { schema });
  const render = (kind: 'grocery' | 'food', q: Parameters<OrderService['adminOrderWhere']>[1]) => {
    const where = service.adminOrderWhere(kind, q);
    if (!where) return where;
    const t = kind === 'grocery' ? schema.groceryOrders : schema.foodOrders;
    return db.select({ id: t.id }).from(t).where(where).toSQL();
  };

  afterAll(async () => {
    // @ts-expect-error pool is internal to the drizzle client
    await db.$client.end();
  });

  it('hides abandoned checkouts when no payment status is chosen', () => {
    const out = render('grocery', {});
    expect(out && out.sql).toContain('"payment_status" in');
    expect(out && out.params).toEqual(expect.arrayContaining(['paid', 'pending_cod', 'collected']));
  });

  it('lets an explicit payment status through, including unpaid ones', () => {
    const out = render('food', { paymentStatus: 'pending' });
    expect(out && out.params).toEqual(['pending']);
  });

  it('matches nothing in food orders for allocation_failed', () => {
    expect(service.adminOrderWhere('food', { status: 'allocation_failed' })).toBeNull();
    expect(service.adminOrderWhere('grocery', { status: 'allocation_failed' })).not.toBeNull();
  });

  it('filters by vendor on grocery and by restaurant on food', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    expect(render('grocery', { vendorId: id })?.sql).toContain('"grocery_orders"."vendor_id" = $');
    expect(render('food', { vendorId: id })?.sql).toContain('"food_orders"."restaurant_id" = $');
  });

  it('searches code prefix, customer, vendor and rider — with the term only ever a bound parameter', () => {
    const out = render('grocery', { search: "50%'; drop table users;--" });
    expect(out).toBeTruthy();
    expect(out!.sql).not.toContain('drop table');
    expect(out!.sql).toContain('::text ilike');
    expect(out!.sql).toContain('cu.phone ilike');
    expect(out!.sql).toContain('v.business_name ilike');
    expect(out!.sql).toContain('du.phone ilike');
    expect(out!.params).toContain("%50\\%'; drop table users;--%");
  });

  it('searches the restaurant name for food orders', () => {
    expect(render('food', { search: 'pizza' })?.sql).toContain('r.name ilike');
  });

  it('bounds the date range by IST days', () => {
    const out = render('grocery', { from: '2026-10-23', to: '2026-10-23' });
    expect(out && out.params).toEqual(
      expect.arrayContaining([istDayStart('2026-10-23').toISOString(), istDayEnd('2026-10-23').toISOString()]),
    );
  });
});
