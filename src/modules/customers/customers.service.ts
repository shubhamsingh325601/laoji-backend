import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../../config/database.module';
import {
  foodOrders,
  groceryOrders,
  users,
  type orderStatusEnum,
} from '../../../drizzle/schema';
import { eq, count, sum, inArray } from 'drizzle-orm';
import type { Db } from '../../config/database.module';

type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

@Injectable()
export class CustomersService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async getCustomersWithStats() {
    // Fetch all users who have a customer role
    const userRows = await this.db.select().from(users).where(eq(users.role, 'customer'));

    if (userRows.length === 0) return [];

    const userIds = userRows.map((u) => u.id);

    // Aggregate grocery orders per customer
    const groceryStats = await this.db
      .select({
        customerId: groceryOrders.customerId,
        totalGroceryOrders: count(groceryOrders.id),
        totalGrocerySpend: sum(groceryOrders.total),
      })
      .from(groceryOrders)
      .where(inArray(groceryOrders.customerId, userIds))
      .groupBy(groceryOrders.customerId);

    // Aggregate food orders per customer
    const foodStats = await this.db
      .select({
        customerId: foodOrders.customerId,
        totalFoodOrders: count(foodOrders.id),
        totalFoodSpend: sum(foodOrders.total),
      })
      .from(foodOrders)
      .where(inArray(foodOrders.customerId, userIds))
      .groupBy(foodOrders.customerId);

    // Build maps for quick lookup
    const groceryMap = new Map<string, { totalGroceryOrders: number; totalGrocerySpend: number }>();
    groceryStats.forEach((row) => {
      groceryMap.set(row.customerId, {
        totalGroceryOrders: Number(row.totalGroceryOrders),
        totalGrocerySpend: Number(row.totalGrocerySpend) || 0,
      });
    });

    const foodMap = new Map<string, { totalFoodOrders: number; totalFoodSpend: number }>();
    foodStats.forEach((row) => {
      foodMap.set(row.customerId, {
        totalFoodOrders: Number(row.totalFoodOrders),
        totalFoodSpend: Number(row.totalFoodSpend) || 0,
      });
    });

    // Combine stats for each user
    const customersWithStats = userRows.map((user) => {
      const g = groceryMap.get(user.id) || { totalGroceryOrders: 0, totalGrocerySpend: 0 };
      const f = foodMap.get(user.id) || { totalFoodOrders: 0, totalFoodSpend: 0 };

      const totalOrders = g.totalGroceryOrders + f.totalFoodOrders;
      const totalSpend = g.totalGrocerySpend + f.totalFoodSpend;

      return {
        id: user.id,
        name: user.name || `Customer +91 ${user.phone}`,
        phone: user.phone,
        joinedAt: user.createdAt,
        totalOrders,
        totalSpend,
        locality: user.city || '',
        supportNotes: user.supportNotes ?? '',
      };
    });

    return customersWithStats;
  }
}