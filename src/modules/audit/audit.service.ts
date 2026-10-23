import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { adminAuditLog, users } from '../../../drizzle/schema';
import { escapeLike, istDayEnd, istDayStart } from '../order/admin-order-filters';
import { AuditListQueryDto } from './dto/audit-list.dto';

export interface AuditEntryInput {
  eventType: 'action' | 'login' | 'login_failed';
  adminId?: string | null;
  // Used when there is no admin id (a failed sign-in only knows what was typed).
  adminEmail?: string | null;
  method: string;
  route: string;
  path: string;
  resource: string;
  action: string;
  targetId?: string | null;
  outcome: 'success' | 'failed';
  statusCode?: number | null;
  errorMessage?: string | null;
  params?: unknown;
  body?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  durationMs?: number | null;
}

const IDENTITY_TTL_MS = 60_000;

// Express hands out route params as an object with no prototype, which Drizzle
// cannot insert; a JSON round trip gives a plain object (and drops anything odd).
function plainJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly identityCache = new Map<string, { email: string | null; name: string | null; at: number }>();

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * Writes one entry. Never throws and never makes the caller wait on the
   * database: a problem with the log must not break the admin's action.
   */
  record(entry: AuditEntryInput): void {
    void this.write(entry).catch((err) => {
      this.logger.warn(`Could not write audit entry (${entry.method} ${entry.route}): ${err?.message ?? err}`);
    });
  }

  private async write(entry: AuditEntryInput): Promise<void> {
    const identity = entry.adminId ? await this.identityOf(entry.adminId) : null;
    await this.db.insert(adminAuditLog).values({
      eventType: entry.eventType,
      adminId: entry.adminId ?? null,
      adminEmail: (identity?.email ?? entry.adminEmail ?? null)?.slice(0, 255) ?? null,
      adminName: identity?.name?.slice(0, 200) ?? null,
      method: entry.method.slice(0, 10),
      route: entry.route.slice(0, 300),
      path: entry.path.slice(0, 500),
      resource: entry.resource,
      action: entry.action,
      targetId: entry.targetId ?? null,
      outcome: entry.outcome,
      statusCode: entry.statusCode ?? null,
      errorMessage: entry.errorMessage ? entry.errorMessage.slice(0, 1000) : null,
      params: plainJson(entry.params),
      body: plainJson(entry.body),
      ip: entry.ip ? entry.ip.slice(0, 64) : null,
      userAgent: entry.userAgent ? entry.userAgent.slice(0, 300) : null,
      durationMs: entry.durationMs ?? null,
    });
  }

  private async identityOf(adminId: string) {
    const cached = this.identityCache.get(adminId);
    if (cached && Date.now() - cached.at < IDENTITY_TTL_MS) return cached;
    const [row] = await this.db
      .select({ email: users.email, name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, adminId))
      .limit(1);
    const identity = { email: row?.email ?? row?.phone ?? null, name: row?.name ?? null, at: Date.now() };
    this.identityCache.set(adminId, identity);
    return identity;
  }

  async list(q: AuditListQueryDto) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));

    const conditions: SQL[] = [];
    if (q.adminId) conditions.push(eq(adminAuditLog.adminId, q.adminId));
    if (q.resource) conditions.push(eq(adminAuditLog.resource, q.resource));
    if (q.outcome) conditions.push(eq(adminAuditLog.outcome, q.outcome));
    if (q.eventType) conditions.push(eq(adminAuditLog.eventType, q.eventType));
    if (q.from) conditions.push(gte(adminAuditLog.createdAt, istDayStart(q.from)));
    if (q.to) conditions.push(lte(adminAuditLog.createdAt, istDayEnd(q.to)));
    const term = q.search?.trim();
    if (term) {
      const like = `%${escapeLike(term)}%`;
      conditions.push(
        or(
          ilike(adminAuditLog.adminEmail, like),
          ilike(adminAuditLog.adminName, like),
          ilike(adminAuditLog.resource, like),
          ilike(adminAuditLog.action, like),
          ilike(adminAuditLog.targetId, like),
          ilike(adminAuditLog.path, like),
        )!,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [{ total }] = await this.db.select({ total: count() }).from(adminAuditLog).where(where);
    const items = await this.db
      .select()
      .from(adminAuditLog)
      .where(where)
      .orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { items, total: Number(total), page, pageSize };
  }

  /** Values for the filter dropdowns. */
  async filters() {
    const [resources, admins] = await Promise.all([
      this.db
        .select({ resource: adminAuditLog.resource })
        .from(adminAuditLog)
        .groupBy(adminAuditLog.resource)
        .orderBy(adminAuditLog.resource),
      this.db
        .select({ id: users.id, email: users.email, name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.role, 'admin'))
        .orderBy(sql`lower(coalesce(${users.name}, ${users.email}, ${users.phone}))`),
    ]);
    return {
      resources: resources.map((r) => r.resource),
      admins: admins.map((a) => ({ id: a.id, email: a.email ?? a.phone, name: a.name })),
    };
  }
}
