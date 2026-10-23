import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { and, count, eq, ne, sql } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { authTokens, users } from '../../../drizzle/schema';
import { CreateAdminAccountDto, UpdateAdminAccountDto } from './dto/admin-account.dto';

export interface AdminAccountRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt: string | null;
  lastActionAt: string | null;
  actionsLast30Days: number;
}

const iso = (v: unknown): string | null => (v ? new Date(v as string | Date).toISOString() : null);

/**
 * Who the admins are. Accounts are created and switched on / off here, not
 * through the generic users endpoints, so there is always at least one admin
 * who can sign in and nobody can lock themselves out by accident.
 */
@Injectable()
export class AdminAccountsService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async list(): Promise<AdminAccountRow[]> {
    const result = await this.db.execute(sql`
      select u.id, u.name, u.email, u.phone, u.status, u.created_at,
             a.last_login, a.last_action, coalesce(a.actions_30d, 0) as actions_30d
      from users u
      left join (
        select admin_id,
               max(created_at) filter (where event_type = 'login') as last_login,
               max(created_at) filter (where event_type = 'action') as last_action,
               count(*) filter (where event_type = 'action' and created_at >= now() - interval '30 days') as actions_30d
        from admin_audit_log
        where admin_id is not null
        group by admin_id
      ) a on a.admin_id = u.id
      where u.role = 'admin'
      order by lower(coalesce(u.name, u.email, u.phone, ''))
    `);
    return (result.rows as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      name: (r.name as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      status: r.status as 'active' | 'suspended',
      createdAt: iso(r.created_at)!,
      lastLoginAt: iso(r.last_login),
      lastActionAt: iso(r.last_action),
      actionsLast30Days: Number(r.actions_30d),
    }));
  }

  async create(dto: CreateAdminAccountDto) {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone?.trim() || null;

    const [sameEmail] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (sameEmail) throw new BadRequestException(`The email ${email} is already in use by another account.`);

    if (phone) {
      const [samePhone] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.phone, phone), eq(users.role, 'admin')))
        .limit(1);
      if (samePhone) throw new BadRequestException(`An admin with phone ${phone} already exists.`);
    }

    const [created] = await this.db
      .insert(users)
      .values({
        role: 'admin',
        status: 'active',
        name: dto.name.trim(),
        email,
        phone,
        passwordHash: await bcrypt.hash(dto.password, 10),
      })
      .returning({ id: users.id, name: users.name, email: users.email, phone: users.phone, status: users.status });
    return created;
  }

  async update(id: string, dto: UpdateAdminAccountDto, actorId: string | undefined) {
    const [target] = await this.db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'admin')))
      .limit(1);
    if (!target) throw new NotFoundException('Admin not found');

    const isSelf = id === actorId;
    if (dto.status === 'suspended' && target.status !== 'suspended') {
      if (isSelf) throw new BadRequestException("You can't suspend your own account.");
      const [{ others }] = await this.db
        .select({ others: count() })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.status, 'active'), ne(users.id, id)));
      if (Number(others) === 0) {
        throw new BadRequestException('This is the last active admin, so it cannot be suspended.');
      }
    }

    const patch: Partial<typeof users.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.password !== undefined) patch.passwordHash = await bcrypt.hash(dto.password, 10);
    if (Object.keys(patch).length === 0) throw new BadRequestException('Nothing to update.');

    const [updated] = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, email: users.email, phone: users.phone, status: users.status });

    // Suspending, or resetting the password of, someone else ends their sessions.
    // The refresh tokens are deleted rather than marked revoked: a token revoked
    // a moment ago is still honoured by the refresh race-tolerance window.
    const endsSessions = dto.status === 'suspended' || dto.password !== undefined;
    if (endsSessions && !isSelf) {
      await this.db.delete(authTokens).where(eq(authTokens.userId, id));
    }
    return updated;
  }
}
