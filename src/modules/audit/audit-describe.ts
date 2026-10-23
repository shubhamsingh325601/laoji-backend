// Pure helpers behind the admin audit log: turning a request into a short
// "resource / action / target", and keeping secrets out of what gets stored.

const API_PREFIX = /^\/api\/v\d+/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ADMIN_LOGIN_ROUTE = '/auth/admin/login';

// Routes an admin token hits that are not admin work: the app registering its
// push token, reading its own notifications, refreshing its session.
const IGNORED_ROUTES = [/^\/users\/me(\/|$)/, /^\/notifications(\/|$)/, /^\/auth\/(refresh|logout)$/];

const VERBS: Record<string, string> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

/** Route pattern without the "/api/v1" prefix, e.g. "/admin/orders/:type/:id/cancel". */
export function normalizeRoute(route: string | undefined | null): string {
  return (route ?? '').replace(API_PREFIX, '').replace(/\/+$/, '') || '/';
}

export function isAuditedMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

export function isIgnoredRoute(route: string): boolean {
  return IGNORED_ROUTES.some((re) => re.test(route));
}

/**
 * "POST /admin/orders/:type/:id/cancel"   -> { resource: 'orders', action: 'cancel' }
 * "PATCH /admin/vendors/:id"              -> { resource: 'vendors', action: 'update' }
 * "POST /admin/vendors/:id/discounts"     -> { resource: 'vendors', action: 'create discounts' }
 * "DELETE /admin/coupons/:id"             -> { resource: 'coupons', action: 'delete' }
 */
export function describeRoute(method: string, route: string): { resource: string; action: string } {
  const segments = route.split('/').filter(Boolean);
  const literals = segments.filter((s) => !s.startsWith(':'));
  const withoutAdmin = literals[0] === 'admin' ? literals.slice(1) : literals;
  const resource = (withoutAdmin[0] ?? 'general').slice(0, 60);
  const rest = withoutAdmin.slice(1);
  const verb = VERBS[method] ?? method.toLowerCase();

  let action: string;
  if (rest.length === 0) {
    action = verb;
  } else {
    const endsWithLiteral = !segments[segments.length - 1].startsWith(':');
    const last = rest[rest.length - 1];
    // "POST .../approve" is a command; "POST .../discounts" creates a discount.
    const isCommand = method === 'POST' && endsWithLiteral && !last.endsWith('s');
    action = isCommand ? rest.join(' ') : `${verb} ${rest.join(' ')}`;
  }
  return { resource, action: action.slice(0, 80) };
}

/** The id the request was about: the last UUID in the route params, else the last param. */
export function targetFromParams(params: Record<string, unknown> | undefined): string | null {
  const values = Object.values(params ?? {})
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map((v) => v.slice(0, 64));
  if (values.length === 0) return null;
  const uuids = values.filter((v) => UUID.test(v));
  return uuids.length > 0 ? uuids[uuids.length - 1] : values[values.length - 1];
}

const SECRET_KEY = /pass(word)?|token|secret|hash|authorization|api[-_]?key|cvv|^otp|otp$|^pin$/i;
const MAX_STRING = 300;
const MAX_BYTES = 4000;
const MAX_DEPTH = 6;

function clean(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[nested]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => clean(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? '[hidden]' : clean(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * What the admin sent, with secrets hidden, long text cut short and the whole
 * thing capped at a few KB. Returns null for an empty body.
 */
export function sanitizeBody(body: unknown): unknown {
  if (body === null || body === undefined) return null;
  if (typeof body === 'object' && Object.keys(body as object).length === 0) return null;
  const cleaned = clean(body, 0);
  const json = JSON.stringify(cleaned);
  if (json.length <= MAX_BYTES) return cleaned;
  return { _truncated: true, _bytes: json.length, preview: json.slice(0, 3000) };
}
