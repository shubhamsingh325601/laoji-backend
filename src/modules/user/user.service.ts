import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
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
        (u) => (u.phone && u.phone.includes(q)) || (u.email && u.email.toLowerCase().includes(q)),
      );
    }

    const allAddresses = await this.db.select().from(addresses);
    const addrMap = new Map(allAddresses.map((a) => [a.userId, a]));

    return filtered.map((u) => {
      const addr = addrMap.get(u.id);
      return {
        id: u.id,
        phone: u.phone,
        email: u.email,
        role: u.role,
        status: u.status,
        name: u.role === 'customer' ? `Customer +91 ${u.phone}` : `${u.role.toUpperCase()} User`,
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
      name: `Customer +91 ${u.phone}`,
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

    const [updated] = await this.db
      .update(users)
      .set({
        phone: dto.phone !== undefined ? dto.phone : u.phone,
        email: dto.email !== undefined ? dto.email : u.email,
        role: dto.role !== undefined ? dto.role : u.role,
        status: dto.status !== undefined ? dto.status : u.status,
      })
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
