import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { addresses, groceryOrders, foodOrders, users } from '../../../drizzle/schema';
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
    const userAddresses = userIds.length
      ? await this.db.select().from(addresses).where(inArray(addresses.userId, userIds))
      : [];

    const addrMap = new Map<string, typeof addresses.$inferSelect>();
    for (const a of userAddresses) {
      if (!addrMap.has(a.userId) || a.isDefault) {
        addrMap.set(a.userId, a);
      }
    }

    return filtered.map((u) => {
      const addr = addrMap.get(u.id);
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
      };
    });
  }

  async getUser(id: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!u) throw new NotFoundException('User not found');

    const userAddresses = await this.db.select().from(addresses).where(eq(addresses.userId, id));
    const groceryList = await this.db.select().from(groceryOrders).where(eq(groceryOrders.customerId, id)).limit(10);
    const foodList = await this.db.select().from(foodOrders).where(eq(foodOrders.customerId, id)).limit(10);

    return {
      id: u.id,
      phone: u.phone,
      email: u.email,
      role: u.role,
      status: u.status,
      name: u.name || `Customer +91 ${u.phone}`,
      supportNotes: u.supportNotes ?? '',
      addresses: userAddresses,
      orderCount: groceryList.length + foodList.length,
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
        lat: 16.705,
        lng: 74.2433,
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

    await this.db.delete(users).where(eq(users.id, id));
    return { success: true, message: `User ${id} deleted successfully.` };
  }
}
