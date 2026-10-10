import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, ne, or, sum } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { addresses, authTokens, groceryOrders, foodOrders, kycDocuments, users, wallets } from '../../../drizzle/schema';
import { NotificationService } from '../notification/notification.service';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/admin-user.dto';

@Injectable()
export class UserService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly notifications: NotificationService,
  ) {}

  async listUsers(role?: string, search?: string) {
    let query = this.db.select().from(users);
    const rows = await query.orderBy(desc(users.createdAt));

    let filtered = rows;
    if (role && role !== 'all') {
      filtered = filtered.filter((u) => u.role === role);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          (u.phone && u.phone.includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.name && u.name.toLowerCase().includes(q)),
      );
    }

    const userIds = filtered.map((u) => u.id);
    let userAddresses: any[] = [];
    try {
      userAddresses = userIds.length
        ? await this.db.select().from(addresses).where(inArray(addresses.userId, userIds))
        : [];
    } catch (err: any) {
      console.warn('[listUsers] addresses query notice:', err?.message || err);
    }

    const addrMap = new Map<string, typeof addresses.$inferSelect>();
    for (const a of userAddresses) {
      if (!addrMap.has(a.userId) || a.isDefault) {
        addrMap.set(a.userId, a);
      }
    }

    let userWallets: any[] = [];
    try {
      userWallets = userIds.length
        ? await this.db.select().from(wallets).where(inArray(wallets.userId, userIds))
        : [];
    } catch (err: any) {
      console.warn('[listUsers] wallets query notice:', err?.message || err);
    }
    const walletMap = new Map(userWallets.map((w) => [w.userId, w]));

    // Order stats count delivered orders only (not cancelled/failed/in-progress). They only apply to customers; the admin Customers list
    // (GET /admin/users?role=customer) reads totalOrders/totalSpend off
    // this response and had nothing to read them from at all before.
    const customerIds = filtered.filter((u) => u.role === 'customer').map((u) => u.id);
    let groceryStats: any[] = [];
    try {
      groceryStats = customerIds.length
        ? await this.db
            .select({ customerId: groceryOrders.customerId, count: count(groceryOrders.id), total: sum(groceryOrders.total) })
            .from(groceryOrders)
            .where(and(inArray(groceryOrders.customerId, customerIds), eq(groceryOrders.status, 'delivered')))
            .groupBy(groceryOrders.customerId)
        : [];
    } catch (err: any) {
      console.warn('[listUsers] groceryStats notice:', err?.message || err);
    }

    let foodStats: any[] = [];
    try {
      foodStats = customerIds.length
        ? await this.db
            .select({ customerId: foodOrders.customerId, count: count(foodOrders.id), total: sum(foodOrders.total) })
            .from(foodOrders)
            .where(and(inArray(foodOrders.customerId, customerIds), eq(foodOrders.status, 'delivered')))
            .groupBy(foodOrders.customerId)
        : [];
    } catch (err: any) {
      console.warn('[listUsers] foodStats notice:', err?.message || err);
    }

    const groceryStatsById = new Map(groceryStats.map((s) => [s.customerId, s]));
    const foodStatsById = new Map(foodStats.map((s) => [s.customerId, s]));

    return filtered.map((u) => {
      const addr = addrMap.get(u.id);
      const g = groceryStatsById.get(u.id);
      const f = foodStatsById.get(u.id);
      const w = walletMap.get(u.id);
      return {
        id: u.id,
        phone: u.phone,
        email: u.email,
        role: u.role,
        status: u.status,
        name: u.name || (u.role === 'customer' ? `Customer +91 ${u.phone}` : `${u.role.toUpperCase()} User`),
        supportNotes: u.supportNotes ?? '',
        address: addr?.formattedAddress ?? 'Rural Area / Locality',
        createdAt: u.createdAt,
        totalOrders: Number(g?.count ?? 0) + Number(f?.count ?? 0),
        totalSpend: (Number(g?.total) || 0) + (Number(f?.total) || 0),
        walletBalance: Math.round(Number(w?.balance ?? 0) * 100) / 100,
      };
    });
  }

  async getUser(id: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!u) throw new NotFoundException('User not found');

    let userAddresses: any[] = [];
    let groceryList: any[] = [];
    let foodList: any[] = [];
    let walletRow: any = null;
    let groceryAgg: any = null;
    let foodAgg: any = null;

    try {
      userAddresses = await this.db.select().from(addresses).where(eq(addresses.userId, id));
    } catch {}

    try {
      groceryList = await this.db.select().from(groceryOrders).where(eq(groceryOrders.customerId, id)).limit(10);
    } catch {}

    try {
      foodList = await this.db.select().from(foodOrders).where(eq(foodOrders.customerId, id)).limit(10);
    } catch {}

    try {
      const [w] = await this.db.select().from(wallets).where(eq(wallets.userId, id)).limit(1);
      walletRow = w;
    } catch {}

    try {
      const [g] = await this.db
        .select({ count: count(groceryOrders.id), total: sum(groceryOrders.total) })
        .from(groceryOrders)
        .where(and(eq(groceryOrders.customerId, id), eq(groceryOrders.status, 'delivered')));
      groceryAgg = g;
    } catch {}

    try {
      const [f] = await this.db
        .select({ count: count(foodOrders.id), total: sum(foodOrders.total) })
        .from(foodOrders)
        .where(and(eq(foodOrders.customerId, id), eq(foodOrders.status, 'delivered')));
      foodAgg = f;
    } catch {}

    return {
      id: u.id,
      phone: u.phone,
      email: u.email,
      role: u.role,
      status: u.status,
      name: u.name || `Customer +91 ${u.phone}`,
      supportNotes: u.supportNotes ?? '',
      addresses: userAddresses,
      orderCount: Number(groceryAgg?.count ?? 0) + Number(foodAgg?.count ?? 0),
      totalSpend: (Number(groceryAgg?.total) || 0) + (Number(foodAgg?.total) || 0),
      walletBalance: walletRow ? Math.round(Number(walletRow.balance) * 100) / 100 : 0,
      recentOrders: [...groceryList, ...foodList].slice(0, 10),
      createdAt: u.createdAt,
    };
  }

  async createUser(dto: CreateAdminUserDto) {
    const role = dto.role ?? 'customer';
    const status = dto.status ?? 'active';

    // Check if phone+role already exists
    const [existing] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.phone, dto.phone), eq(users.role, role)))
      .limit(1);

    if (existing) {
      throw new BadRequestException(`An account with phone ${dto.phone} and role ${role} already exists.`);
    }

    const [created] = await this.db
      .insert(users)
      .values({
        phone: dto.phone,
        email: dto.email || null,
        name: dto.name || null,
        role,
        status,
      })
      .returning();

    if (dto.address) {
      await this.db.insert(addresses).values({
        userId: created.id,
        label: 'Home',
        lat: 24.924,
        lng: 76.283,
        formattedAddress: dto.address + (dto.city ? `, ${dto.city}` : ''),
        isDefault: true,
      });
    }

    // Send Welcome Email with official corporate signature
    if (dto.email) {
      this.notifications.sendWelcomeCustomerEmail({
        id: created.id,
        name: dto.name || `User +91 ${dto.phone}`,
        email: dto.email,
        phone: dto.phone,
      });
    }

    return created;
  }

  async updateUser(id: string, dto: UpdateAdminUserDto) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!u) throw new NotFoundException('User not found');

    const targetRole = dto.role !== undefined ? dto.role : u.role;
    const targetPhone = dto.phone !== undefined ? dto.phone.trim() : u.phone;
    const targetEmail = dto.email !== undefined ? (dto.email ? dto.email.trim() : null) : u.email;

    // Validate phone uniqueness for this role
    if (targetPhone && (targetPhone !== u.phone || targetRole !== u.role)) {
      const [existingPhone] = await this.db
        .select()
        .from(users)
        .where(and(eq(users.phone, targetPhone), eq(users.role, targetRole), ne(users.id, id)))
        .limit(1);

      if (existingPhone) {
        throw new BadRequestException(`An account with phone ${targetPhone} and role ${targetRole} already exists.`);
      }
    }

    // Validate email uniqueness across all users
    if (targetEmail && targetEmail !== u.email) {
      const [existingEmail] = await this.db
        .select()
        .from(users)
        .where(and(eq(users.email, targetEmail), ne(users.id, id)))
        .limit(1);

      if (existingEmail) {
        throw new BadRequestException(`The email ${targetEmail} is already in use by another account.`);
      }
    }

    const updateData: Partial<typeof users.$inferInsert> = {
      phone: targetPhone,
      email: targetEmail,
      role: targetRole,
      status: dto.status !== undefined ? dto.status : u.status,
    };

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim() || null;
    }
    if (dto.supportNotes !== undefined) {
      updateData.supportNotes = dto.supportNotes.trim() || null;
    }

    const [updated] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    return updated;
  }

  async deleteUser(id: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!u) throw new NotFoundException('User not found');

    // 1. Delete KYC documents belonging to this user
    await this.db.delete(kycDocuments).where(eq(kycDocuments.userId, id));

    // 2. Revoke auth tokens
    await this.db
      .update(authTokens)
      .set({ revokedAt: new Date() })
      .where(eq(authTokens.userId, id));

    // 3. Try hard deleting the user (cascades to vendors, partners, addresses, etc.) or scrub if FK constraint prevents
    try {
      await this.db.delete(users).where(eq(users.id, id));
    } catch {
      await this.db
        .update(users)
        .set({ status: 'suspended', phone: null, email: null, name: null })
        .where(eq(users.id, id));
    }

    return { success: true, message: `User ${id} deleted successfully.` };
  }
}
