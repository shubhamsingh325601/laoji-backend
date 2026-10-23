import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import {
  describeRoute,
  isAuditedMethod,
  isIgnoredRoute,
  normalizeRoute,
  sanitizeBody,
  targetFromParams,
} from './audit-describe';

describe('audit-describe', () => {
  it('strips the api prefix from route patterns', () => {
    expect(normalizeRoute('/api/v1/admin/orders/:type/:id/cancel')).toBe('/admin/orders/:type/:id/cancel');
    expect(normalizeRoute('/admin/coupons/')).toBe('/admin/coupons');
    expect(normalizeRoute(undefined)).toBe('/');
  });

  it('only audits writes', () => {
    expect(['GET', 'HEAD', 'OPTIONS'].some(isAuditedMethod)).toBe(false);
    expect(['POST', 'PUT', 'PATCH', 'DELETE'].every(isAuditedMethod)).toBe(true);
  });

  it.each([
    ['POST', '/admin/orders/:type/:id/cancel', 'orders', 'cancel'],
    ['PATCH', '/admin/vendors/:id', 'vendors', 'update'],
    ['DELETE', '/admin/coupons/:id', 'coupons', 'delete'],
    ['POST', '/admin/coupons', 'coupons', 'create'],
    ['POST', '/admin/vendors/:vendorId/discounts', 'vendors', 'create discounts'],
    ['PATCH', '/admin/vendors/:vendorId/discounts/:id', 'vendors', 'update discounts'],
    ['POST', '/admin/wallet/adjust', 'wallet', 'adjust'],
    ['POST', '/admin/vendor-withdrawals/:id/approve', 'vendor-withdrawals', 'approve'],
    ['PATCH', '/uploads/kyc-documents/:id/review', 'uploads', 'update kyc-documents review'],
    ['PUT', '/admin/revenue/config', 'revenue', 'update config'],
  ])('describes %s %s', (method, route, resource, action) => {
    expect(describeRoute(method, route)).toEqual({ resource, action });
  });

  it('finds the target of a request', () => {
    const id = '0b1f8a4e-6f3c-4a41-9a50-1c2d3e4f5a6b';
    expect(targetFromParams({ type: 'grocery', id })).toBe(id);
    expect(targetFromParams({ type: 'grocery', code: 'abc' })).toBe('abc');
    expect(targetFromParams({})).toBeNull();
    expect(targetFromParams(undefined)).toBeNull();
  });

  it('hides secrets at any depth and keeps everything else', () => {
    const out = sanitizeBody({
      name: 'Asha',
      password: 'hunter2',
      nested: { refreshToken: 'abc', deliveryOtp: '1234', note: 'ok', pin: '9' },
      list: [{ apiKey: 'k', amount: 5 }],
    }) as any;
    expect(out.name).toBe('Asha');
    expect(out.password).toBe('[hidden]');
    expect(out.nested).toEqual({ refreshToken: '[hidden]', deliveryOtp: '[hidden]', note: 'ok', pin: '[hidden]' });
    expect(out.list).toEqual([{ apiKey: '[hidden]', amount: 5 }]);
    expect(JSON.stringify(out)).not.toContain('hunter2');
  });

  it('does not mistake ordinary words for secrets', () => {
    const out = sanitizeBody({ shipping: 'x', footprint: 'y', description: 'z' }) as any;
    expect(out).toEqual({ shipping: 'x', footprint: 'y', description: 'z' });
  });

  it('stores nothing for an empty body and caps a huge one', () => {
    expect(sanitizeBody(undefined)).toBeNull();
    expect(sanitizeBody({})).toBeNull();
    const huge = sanitizeBody({ items: Array.from({ length: 50 }, (_, i) => ({ i, text: 'x'.repeat(250) })) }) as any;
    expect(huge._truncated).toBe(true);
    expect(JSON.stringify(huge).length).toBeLessThan(3200);
  });

  it('ignores self-service routes an admin app calls in the background', () => {
    expect(isIgnoredRoute('/users/me/fcm-token')).toBe(true);
    expect(isIgnoredRoute('/notifications/read-all')).toBe(true);
    expect(isIgnoredRoute('/auth/refresh')).toBe(true);
    expect(isIgnoredRoute('/admin/notifications')).toBe(false);
  });
});

describe('AuditService.record', () => {
  it('stores route params as a plain object (Express gives them no prototype)', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const db = {
      insert: () => ({ values }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ email: 'a@b.c', name: 'A' }] }) }) }),
    };
    const service = new AuditService(db as any);
    const params = Object.create(null);
    params.id = 'abc';

    service.record({
      eventType: 'action',
      adminId: '11111111-1111-4111-8111-111111111111',
      method: 'PATCH',
      route: '/admin/vendors/:id',
      path: '/api/v1/admin/vendors/abc',
      resource: 'vendors',
      action: 'update',
      outcome: 'success',
      params,
      body: { name: 'x' },
    });
    await new Promise((r) => setImmediate(r));

    const row = values.mock.calls[0][0];
    expect(Object.getPrototypeOf(row.params)).toBe(Object.prototype);
    expect(row).toMatchObject({ params: { id: 'abc' }, body: { name: 'x' }, adminEmail: 'a@b.c', adminName: 'A' });
  });

  it('never throws when the database does', async () => {
    const db = { insert: () => ({ values: () => Promise.reject(new Error('db down')) }) };
    const service = new AuditService(db as any);
    expect(() =>
      service.record({
        eventType: 'login_failed',
        method: 'POST',
        route: '/auth/admin/login',
        path: '/api/v1/auth/admin/login',
        resource: 'auth',
        action: 'sign in',
        outcome: 'failed',
      }),
    ).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });
});

describe('AuditInterceptor', () => {
  const adminId = '11111111-1111-4111-8111-111111111111';

  function setup(req: Record<string, unknown>, res: Record<string, unknown> = { statusCode: 201 }) {
    const record = jest.fn();
    const interceptor = new AuditInterceptor({ record } as any);
    const ctx = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any;
    return { record, run: (handler: any) => lastValueFrom(interceptor.intercept(ctx, { handle: () => handler })).catch((e) => e) };
  }

  const adminReq = (over: Record<string, unknown> = {}) => ({
    method: 'POST',
    route: { path: '/api/v1/admin/orders/:type/:id/cancel' },
    originalUrl: '/api/v1/admin/orders/grocery/abc/cancel?x=1',
    params: { type: 'grocery', id: 'abc' },
    body: { reason: 'out of stock', password: 'nope' },
    headers: { 'user-agent': 'jest', 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    user: { sub: adminId, role: 'admin' },
    ...over,
  });

  it('records a successful admin write with who, what, target and a redacted body', async () => {
    const { record, run } = setup(adminReq());
    await run(of({ ok: true }));
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({
      eventType: 'action',
      adminId,
      method: 'POST',
      route: '/admin/orders/:type/:id/cancel',
      path: '/api/v1/admin/orders/grocery/abc/cancel',
      resource: 'orders',
      action: 'cancel',
      targetId: 'abc',
      outcome: 'success',
      statusCode: 201,
      ip: '203.0.113.9',
      userAgent: 'jest',
      body: { reason: 'out of stock', password: '[hidden]' },
    });
  });

  it('records a failed admin write with the error', async () => {
    const { record, run } = setup(adminReq());
    await run(throwError(() => new ForbiddenException('Order already delivered')));
    expect(record.mock.calls[0][0]).toMatchObject({
      outcome: 'failed',
      statusCode: 403,
      errorMessage: 'Order already delivered',
    });
  });

  it.each([
    ['a read', { method: 'GET' }],
    ['a non-admin user', { user: { sub: 'x', role: 'vendor' } }],
    ['an anonymous request', { user: undefined }],
    ['a background self-service route', { route: { path: '/api/v1/users/me/fcm-token' } }],
  ])('does not record %s', async (_label, over) => {
    const { record, run } = setup(adminReq(over));
    await run(of(1));
    expect(record).not.toHaveBeenCalled();
  });

  it('records admin sign-ins, without the password', async () => {
    const req = {
      method: 'POST',
      route: { path: '/api/v1/auth/admin/login' },
      originalUrl: '/api/v1/auth/admin/login',
      params: {},
      body: { email: ' Shubham@LaojiOnline.com ', password: 'secret-pass' },
      headers: {},
    };
    const ok = setup(req);
    await ok.run(of({ userId: adminId, role: 'admin', tokens: {} }));
    expect(ok.record.mock.calls[0][0]).toMatchObject({
      eventType: 'login',
      adminId,
      adminEmail: 'shubham@laojionline.com',
      outcome: 'success',
    });
    expect(JSON.stringify(ok.record.mock.calls[0][0])).not.toContain('secret-pass');

    const bad = setup(req);
    await bad.run(throwError(() => new UnauthorizedException('Invalid email or password')));
    expect(bad.record.mock.calls[0][0]).toMatchObject({
      eventType: 'login_failed',
      adminEmail: 'shubham@laojionline.com',
      outcome: 'failed',
      statusCode: 401,
    });
    expect(bad.record.mock.calls[0][0].adminId).toBeUndefined();
    expect(JSON.stringify(bad.record.mock.calls[0][0])).not.toContain('secret-pass');
  });
});
